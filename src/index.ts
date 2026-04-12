/**
 * sheetsdb — A lightweight, type-safe TypeScript ORM for Google Sheets.
 */

// Client
export { createClient } from './client';
export type { SheetsdbClient } from './client';

// Model
export { defineModel } from './model';
export type { Model } from './model';

// Type system
export { t } from './type-builders';

// Types
export type {
  Schema,
  ColumnType,
  InferRow,
  Filter,
  FilterOperators,
  FindManyOptions,
  ClientConfig,
} from './types';

// Errors
export {
  SheetsdbError,
  SheetsdbAuthError,
  SheetsdbNotFoundError,
  SheetsdbValidationError,
  SheetsdbRateLimitError,
} from './errors';

