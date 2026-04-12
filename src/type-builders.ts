/**
 * Type builder helpers — the `t.*` API for defining column types in schemas.
 */

import { ColumnType } from './types';

function makeType<T>(type: ColumnType['type'], enumValues?: readonly string[]): ColumnType<T> {
  return {
    type,
    isOptional: false,
    enumValues,
    optional(): ColumnType<T | null> {
      return {
        type,
        isOptional: true,
        enumValues,
        optional() {
          return this;
        },
      };
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
  string: () => makeType<string>('string'),
  number: () => makeType<number>('number'),
  boolean: () => makeType<boolean>('boolean'),
  date: () => makeType<Date>('date'),
  enum: <T extends string>(values: readonly T[]) => makeType<T>('enum', values),
};
