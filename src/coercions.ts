/**
 * Type coercion helpers — convert raw sheet cell values to typed JS values.
 */

import { ColumnType } from './types';
import { SheetsdbValidationError } from './errors';

/**
 * Coerce a raw cell value (always a string from Sheets) to the declared type.
 */
export function coerceValue(raw: string | undefined | null, column: ColumnType, fieldName: string): unknown {
  // Handle empty / missing cells
  if (raw === undefined || raw === null || raw === '') {
    if (column.isOptional) {
      return null;
    }
    throw new SheetsdbValidationError(`Field "${fieldName}" is required but cell is empty`);
  }

  switch (column.type) {
    case 'string':
      return raw;

    case 'number': {
      const num = Number(raw);
      if (isNaN(num)) {
        throw new SheetsdbValidationError(`Field "${fieldName}" expected a number but got "${raw}"`);
      }
      return num;
    }

    case 'boolean': {
      const lower = raw.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      throw new SheetsdbValidationError(`Field "${fieldName}" expected a boolean but got "${raw}"`);
    }

    case 'date': {
      const date = new Date(raw);
      if (isNaN(date.getTime())) {
        throw new SheetsdbValidationError(`Field "${fieldName}" expected a date but got "${raw}"`);
      }
      return date;
    }

    case 'enum': {
      if (column.enumValues && !column.enumValues.includes(raw)) {
        throw new SheetsdbValidationError(
          `Field "${fieldName}" expected one of [${column.enumValues.join(', ')}] but got "${raw}"`
        );
      }
      return raw;
    }

    default:
      return raw;
  }
}

/**
 * Serialize a JS value back to a string suitable for writing to a sheet cell.
 */
export function serializeValue(value: unknown, column: ColumnType, fieldName: string): string {
  if (value === null || value === undefined) {
    if (column.isOptional) {
      return '';
    }
    throw new SheetsdbValidationError(`Field "${fieldName}" is required but value is null`);
  }

  switch (column.type) {
    case 'string':
      return String(value);

    case 'number':
      return String(value);

    case 'boolean':
      return value ? 'TRUE' : 'FALSE';

    case 'date':
      return value instanceof Date ? value.toISOString() : String(value);

    case 'enum': {
      const str = String(value);
      if (column.enumValues && !column.enumValues.includes(str)) {
        throw new SheetsdbValidationError(
          `Field "${fieldName}" expected one of [${column.enumValues.join(', ')}] but got "${str}"`
        );
      }
      return str;
    }

    default:
      return String(value);
  }
}
