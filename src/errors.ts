/**
 * Custom error types for sheetsdb.
 */

export class SheetsdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsdbError';
  }
}

export class SheetsdbAuthError extends SheetsdbError {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsdbAuthError';
  }
}

export class SheetsdbNotFoundError extends SheetsdbError {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsdbNotFoundError';
  }
}

export class SheetsdbValidationError extends SheetsdbError {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsdbValidationError';
  }
}

export class SheetsdbRateLimitError extends SheetsdbError {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsdbRateLimitError';
  }
}
