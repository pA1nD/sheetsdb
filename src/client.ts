/**
 * Client — connects to a Google Spreadsheet via service account credentials.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { ClientConfig } from './types';
import { SheetsdbAuthError, SheetsdbNotFoundError, SheetsdbRateLimitError, SheetsdbError } from './errors';

export interface SheetsdbClient {
  /** The underlying google-spreadsheet instance. */
  readonly raw: GoogleSpreadsheet;
  /** The spreadsheet ID. */
  readonly spreadsheetId: string;
  /** Cache TTL in milliseconds. */
  readonly cacheTTL: number;
}

/**
 * Create a sheetsdb client connected to a Google Spreadsheet.
 *
 * Validates the connection eagerly — throws on bad credentials or
 * unreachable spreadsheet.
 */
export async function createClient(config: ClientConfig): Promise<SheetsdbClient> {
  const { spreadsheetId, auth, cacheTTL = 60000 } = config;

  const jwt = new JWT({
    email: auth.clientEmail,
    key: auth.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, jwt);

  try {
    await doc.loadInfo();
  } catch (err: unknown) {
    const status = extractHttpStatus(err);

    if (status === 404) {
      throw new SheetsdbNotFoundError(`Spreadsheet not found: ${spreadsheetId}`);
    }
    if (status === 403) {
      throw new SheetsdbAuthError(
        `Access denied: share the spreadsheet with ${auth.clientEmail}`
      );
    }
    if (status === 429) {
      throw new SheetsdbRateLimitError('Google Sheets API rate limit exceeded');
    }

    // No HTTP status → network-level error (DNS, timeout, ECONNREFUSED)
    if (status === undefined) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SheetsdbError(`Connection failed: ${message}`, 'CONNECTION_ERROR');
    }

    // 401 or any other HTTP error → bad credentials
    throw new SheetsdbAuthError('Invalid credentials');
  }

  return {
    raw: doc,
    spreadsheetId,
    cacheTTL,
  };
}

/**
 * Extract an HTTP status code from an error thrown by google-spreadsheet
 * or google-auth-library. Returns undefined when no status can be found.
 */
function extractHttpStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;

  const record = err as Record<string, unknown>;

  // google-spreadsheet v4 attaches response.status
  if (
    record['response'] != null &&
    typeof record['response'] === 'object' &&
    typeof (record['response'] as Record<string, unknown>)['status'] === 'number'
  ) {
    return (record['response'] as Record<string, unknown>)['status'] as number;
  }

  // Some Google API errors expose .code directly
  if (typeof record['code'] === 'number') return record['code'];

  // googleapis errors sometimes have a numeric status string
  if (typeof record['status'] === 'number') return record['status'];

  return undefined;
}
