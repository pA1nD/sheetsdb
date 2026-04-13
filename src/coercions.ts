/**
 * Type coercion helpers — convert raw sheet cell values to typed JS values.
 *
 * Delegates to the `read` and `write` methods on each column's type descriptor.
 */

import { ColumnType } from './types';

/**
 * Coerce a raw cell value to the declared type using the column descriptor's read method.
 */
export function coerceValue(raw: unknown, column: ColumnType, fieldName: string): unknown {
  return column.read(raw, fieldName);
}

/**
 * Serialize a JS value back to a string suitable for writing to a sheet cell
 * using the column descriptor's write method.
 */
export function serializeValue(value: unknown, column: ColumnType, fieldName: string): string {
  return column.write(value, fieldName);
}
