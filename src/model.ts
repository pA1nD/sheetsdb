/**
 * Model — maps a sheet tab to a typed, queryable model.
 */

import { v4 as uuidv4 } from 'uuid';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { SheetsdbClient } from './client';
import { Schema, InferRow, Filter, FindManyOptions } from './types';
import { SheetsdbNotFoundError, SheetsdbValidationError } from './errors';
import { coerceValue, serializeValue } from './coercions';
import { matchesAllFilters } from './filters';

const ID_COLUMN = '_id';

export interface Model<S extends Schema> {
  /** Find all rows matching an optional filter. */
  findMany(filter?: Filter<S>, options?: FindManyOptions): Promise<InferRow<S>[]>;
  /** Find the first row matching a filter, or null. */
  findOne(filter: Filter<S>): Promise<InferRow<S> | null>;
  /** Create a new row and return it with its generated _id. */
  create(data: Omit<{ [K in keyof S]: S[K]['isOptional'] extends true ? InferRow<S>[K] | null : InferRow<S>[K] }, '_id'>): Promise<InferRow<S>>;
  /** Update all rows matching a filter. Returns the count of updated rows. */
  update(filter: Filter<S>, data: Partial<{ [K in keyof S]: InferRow<S>[K] }>): Promise<number>;
  /** Delete all rows matching a filter. Returns the count of deleted rows. */
  delete(filter: Filter<S>): Promise<number>;
  /** Count rows matching an optional filter. */
  count(filter?: Filter<S>): Promise<number>;
  /** Force a cache refresh for this model. */
  sync(): Promise<void>;
}

/**
 * Define a model backed by a sheet tab.
 */
export function defineModel<S extends Schema>(
  client: SheetsdbClient,
  sheetName: string,
  schema: S,
): Model<S> {
  let cachedSheet: GoogleSpreadsheetWorksheet | null = null;
  let cacheTimestamp = 0;

  async function getSheet(): Promise<GoogleSpreadsheetWorksheet> {
    const sheet = client.raw.sheetsByTitle[sheetName];
    if (!sheet) {
      throw new SheetsdbNotFoundError(`Sheet tab "${sheetName}" does not exist`);
    }
    return sheet;
  }

  async function ensureIdColumn(sheet: GoogleSpreadsheetWorksheet): Promise<void> {
    await sheet.loadHeaderRow();
    const headers = sheet.headerValues;
    if (!headers.includes(ID_COLUMN)) {
      // Add _id as the first column by updating the header row
      sheet.setHeaderRow([ID_COLUMN, ...headers]);
    }
  }

  async function loadRows(sheet: GoogleSpreadsheetWorksheet) {
    const now = Date.now();
    if (cachedSheet === sheet && (now - cacheTimestamp) < client.cacheTTL) {
      // Use cached rows
    } else {
      await sheet.loadHeaderRow();
      cachedSheet = sheet;
      cacheTimestamp = now;
    }
    return sheet.getRows();
  }

  function rowToObject(row: { get(key: string): string }, schemaKeys: string[]): InferRow<S> {
    const obj: Record<string, unknown> = {
      _id: row.get(ID_COLUMN),
    };
    for (const key of schemaKeys) {
      obj[key] = coerceValue(row.get(key), schema[key], key);
    }
    return obj as InferRow<S>;
  }

  function invalidateCache(): void {
    cacheTimestamp = 0;
  }

  const schemaKeys = Object.keys(schema);

  return {
    async findMany(filter?: Filter<S>, options?: FindManyOptions): Promise<InferRow<S>[]> {
      const sheet = await getSheet();
      await ensureIdColumn(sheet);
      const rows = await loadRows(sheet);

      let results = rows.map((row) => rowToObject(row, schemaKeys));

      if (filter && Object.keys(filter).length > 0) {
        results = results.filter((row) => matchesAllFilters(row as Record<string, unknown>, filter as Record<string, unknown>));
      }

      if (options?.sortBy) {
        const sortKey = options.sortBy;
        const order = options.sortOrder === 'desc' ? -1 : 1;
        results.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[sortKey];
          const bVal = (b as Record<string, unknown>)[sortKey];
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          return aVal < bVal ? -order : order;
        });
      }

      if (options?.offset) {
        results = results.slice(options.offset);
      }
      if (options?.limit) {
        results = results.slice(0, options.limit);
      }

      return results;
    },

    async findOne(filter: Filter<S>): Promise<InferRow<S> | null> {
      const results = await this.findMany(filter, { limit: 1 });
      return results.length > 0 ? results[0] : null;
    },

    async create(data: Record<string, unknown>): Promise<InferRow<S>> {
      const sheet = await getSheet();
      await ensureIdColumn(sheet);

      // Validate required fields
      for (const key of schemaKeys) {
        if (!schema[key].isOptional && (data[key] === undefined || data[key] === null)) {
          throw new SheetsdbValidationError(`Field "${key}" is required`);
        }
      }

      const id = uuidv4();
      const rowData: Record<string, string> = { [ID_COLUMN]: id };

      for (const key of schemaKeys) {
        rowData[key] = serializeValue(data[key], schema[key], key);
      }

      await sheet.addRow(rowData);
      invalidateCache();

      // Build return object
      const result: Record<string, unknown> = { _id: id };
      for (const key of schemaKeys) {
        result[key] = coerceValue(rowData[key], schema[key], key);
      }
      return result as InferRow<S>;
    },

    async update(filter: Filter<S>, data: Partial<Record<string, unknown>>): Promise<number> {
      const sheet = await getSheet();
      await ensureIdColumn(sheet);
      const rows = await sheet.getRows();

      let count = 0;
      for (const row of rows) {
        const obj = rowToObject(row, schemaKeys);
        if (matchesAllFilters(obj as Record<string, unknown>, filter as Record<string, unknown>)) {
          for (const [key, value] of Object.entries(data)) {
            if (key in schema) {
              row.set(key, serializeValue(value, schema[key], key));
            }
          }
          await row.save();
          count++;
        }
      }

      if (count > 0) invalidateCache();
      return count;
    },

    async delete(filter: Filter<S>): Promise<number> {
      const sheet = await getSheet();
      await ensureIdColumn(sheet);
      const rows = await sheet.getRows();

      // Collect indices to delete (bottom-up to avoid index shifting)
      const toDelete: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        const obj = rowToObject(rows[i], schemaKeys);
        if (matchesAllFilters(obj as Record<string, unknown>, filter as Record<string, unknown>)) {
          toDelete.push(i);
        }
      }

      // Delete bottom-up
      for (let i = toDelete.length - 1; i >= 0; i--) {
        await rows[toDelete[i]].delete();
      }

      if (toDelete.length > 0) invalidateCache();
      return toDelete.length;
    },

    async count(filter?: Filter<S>): Promise<number> {
      const results = await this.findMany(filter);
      return results.length;
    },

    async sync(): Promise<void> {
      invalidateCache();
      const sheet = await getSheet();
      await loadRows(sheet);
    },
  };
}
