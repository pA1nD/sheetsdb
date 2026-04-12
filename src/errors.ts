/**
 * Custom error types for sheetsdb.
 */

export class SheetsdbError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SheetsdbError';
    this.code = code;
  }
}

export class SheetsdbAuthError extends SheetsdbError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'SheetsdbAuthError';
  }
}

export class SheetsdbNotFoundError extends SheetsdbError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'SheetsdbNotFoundError';
  }
}

export class SheetsdbValidationError extends SheetsdbError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'SheetsdbValidationError';
    this.field = field;
  }
}

export class SheetsdbRateLimitError extends SheetsdbError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT');
    this.name = 'SheetsdbRateLimitError';
  }
}
