/**
 * Type builder helpers — the `t.*` API for defining column types in schemas.
 *
 * Each type descriptor is an object with { _type, _optional, read(raw), write(value) }.
 * `.optional()` returns a new descriptor with `_optional: true` and wrapped read/write.
 */

import { ColumnType } from './types';
import { SheetsdbValidationError } from './errors';

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === '';
}

/**
 * Wrap any type descriptor to make it optional.
 * - read: empty cell → null instead of error
 * - write: null/undefined → empty string
 */
function makeOptional<T>(descriptor: ColumnType<T>): ColumnType<T | null> {
  return {
    _type: descriptor._type,
    _optional: true,
    enumValues: descriptor.enumValues,
    read(raw: unknown, fieldName: string): T | null {
      if (isEmpty(raw)) return null;
      return descriptor.read(raw, fieldName);
    },
    write(value: T | null, fieldName: string): string {
      if (value === null || value === undefined) return '';
      return descriptor.write(value, fieldName);
    },
    optional() {
      return this;
    },
  };
}

/**
 * Type builders for defining model schemas.
 *
 * @example
 * ```ts
 * const schema = {
 *   name:     t.string(),
 *   age:      t.number(),
 *   active:   t.boolean(),
 *   joined:   t.date().optional(),
 *   status:   t.enum(['Active', 'Inactive']),
 * }
 * ```
 */
export const t = {
  string(): ColumnType<string> {
    return {
      _type: 'string',
      _optional: false,
      read(raw: unknown, _fieldName: string): string {
        if (isEmpty(raw)) return '';
        return String(raw);
      },
      write(value: string, fieldName: string): string {
        if (typeof value !== 'string') {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected string, got '${value}'`,
            fieldName,
          );
        }
        return value;
      },
      optional() {
        return makeOptional(this);
      },
    };
  },

  number(): ColumnType<number> {
    return {
      _type: 'number',
      _optional: false,
      read(raw: unknown, fieldName: string): number {
        if (isEmpty(raw)) {
          throw new SheetsdbValidationError(`Field '${fieldName}' is required`, fieldName);
        }
        if (typeof raw === 'number') return raw;
        const str = String(raw).replace(/,/g, '');
        const num = parseFloat(str);
        if (isNaN(num)) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected number, got '${raw}'`,
            fieldName,
          );
        }
        return num;
      },
      write(value: number, fieldName: string): string {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected number, got '${value}'`,
            fieldName,
          );
        }
        return value.toString();
      },
      optional() {
        return makeOptional(this);
      },
    };
  },

  boolean(): ColumnType<boolean> {
    return {
      _type: 'boolean',
      _optional: false,
      read(raw: unknown, fieldName: string): boolean {
        if (isEmpty(raw)) {
          throw new SheetsdbValidationError(`Field '${fieldName}' is required`, fieldName);
        }
        const lower = String(raw).toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === '1') return true;
        if (lower === 'false' || lower === 'no' || lower === '0') return false;
        throw new SheetsdbValidationError(
          `Field '${fieldName}': expected boolean, got '${raw}'`,
          fieldName,
        );
      },
      write(value: boolean, fieldName: string): string {
        if (typeof value !== 'boolean') {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected boolean, got '${value}'`,
            fieldName,
          );
        }
        return value ? 'TRUE' : 'FALSE';
      },
      optional() {
        return makeOptional(this);
      },
    };
  },

  date(): ColumnType<Date> {
    return {
      _type: 'date',
      _optional: false,
      read(raw: unknown, fieldName: string): Date {
        if (isEmpty(raw)) {
          throw new SheetsdbValidationError(`Field '${fieldName}' is required`, fieldName);
        }
        if (raw instanceof Date) return raw;
        const str = String(raw);
        // Serial number: pure integer with no dashes or slashes
        if (/^\d+$/.test(str)) {
          const serial = parseInt(str, 10);
          return new Date((serial - 25569) * 86400 * 1000);
        }
        // Formatted string — try Date.parse
        const ms = Date.parse(str);
        if (isNaN(ms)) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected date, got '${raw}'`,
            fieldName,
          );
        }
        return new Date(ms);
      },
      write(value: Date, fieldName: string): string {
        if (!(value instanceof Date) || isNaN(value.getTime())) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': expected Date, got '${value}'`,
            fieldName,
          );
        }
        return value.toISOString().split('T')[0];
      },
      optional() {
        return makeOptional(this);
      },
    };
  },

  enum<T extends string>(values: readonly T[]): ColumnType<T> {
    return {
      _type: 'enum',
      _optional: false,
      enumValues: values,
      read(raw: unknown, fieldName: string): T {
        if (isEmpty(raw)) {
          throw new SheetsdbValidationError(`Field '${fieldName}' is required`, fieldName);
        }
        const str = String(raw);
        if (!values.includes(str as T)) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': '${str}' is not a valid enum value. Expected one of: ${values.join(', ')}`,
            fieldName,
          );
        }
        return str as T;
      },
      write(value: T, fieldName: string): string {
        const str = String(value);
        if (!values.includes(str as T)) {
          throw new SheetsdbValidationError(
            `Field '${fieldName}': '${str}' is not a valid enum value. Expected one of: ${values.join(', ')}`,
            fieldName,
          );
        }
        return str;
      },
      optional() {
        return makeOptional(this);
      },
    };
  },
};
