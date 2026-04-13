/**
 * Core type definitions for sheetsdb.
 */

/** Supported column type identifiers. */
export type ColumnTypeId = 'string' | 'number' | 'boolean' | 'date' | 'enum';

/** A column type descriptor produced by the `t.*` helpers. */
export interface ColumnType<T = unknown> {
  readonly _type: ColumnTypeId;
  readonly _optional: boolean;
  readonly enumValues?: readonly string[];
  read(raw: unknown, fieldName: string): T;
  write(value: T, fieldName: string): string;
  optional(): ColumnType<T | null>;
}

/** A schema is a record mapping column names to column types. */
export type Schema = Record<string, ColumnType>;

/** Infer the TypeScript type of a single column type. */
export type InferColumnType<C extends ColumnType> =
  C extends ColumnType<infer T> ? T : never;

/** Infer the full row type from a schema, plus the auto-managed `_id`. */
export type InferRow<S extends Schema> = {
  [K in keyof S]: InferColumnType<S[K]>;
} & { _id: string };

/** Filter operators for querying. */
export interface FilterOperators<T = unknown> {
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  isNull?: boolean;
  in?: T[];
  notIn?: T[];
}

/** A filter for a given schema — each field can be a direct value or an operator object. */
export type Filter<S extends Schema> = {
  [K in keyof S]?: InferColumnType<S[K]> | FilterOperators<InferColumnType<S[K]>>;
} & {
  _id?: string | FilterOperators<string>;
};

/**
 * Input type for creating a new row.
 * Required fields must be provided; optional fields (where null is valid) can be omitted.
 */
export type CreateInput<S extends Schema> =
  { [K in keyof S as null extends InferColumnType<S[K]> ? never : K]: InferColumnType<S[K]> } &
  { [K in keyof S as null extends InferColumnType<S[K]> ? K : never]?: InferColumnType<S[K]> };

/**
 * Input type for updating rows. All fields are optional.
 */
export type UpdateInput<S extends Schema> = Partial<{ [K in keyof S]: InferColumnType<S[K]> }>;

/** Options for findMany queries. */
export interface FindManyOptions<S extends Schema = Schema> {
  limit?: number;
  offset?: number;
  sortBy?: keyof S & string;
  sortOrder?: 'asc' | 'desc';
}

/** Configuration for createClient. */
export interface ClientConfig {
  spreadsheetId: string;
  auth: {
    clientEmail: string;
    privateKey: string;
  };
  cacheTTL?: number;
}
