/**
 * Client — connects to a Google Spreadsheet via service account credentials.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { ClientConfig } from './types';
import { SheetsdbAuthError } from './errors';

export interface SheetsdbClient {
  /** The underlying google-spreadsheet instance. */
  raw: GoogleSpreadsheet;
  /** The spreadsheet ID. */
  spreadsheetId: string;
  /** Cache TTL in milliseconds. */
  cacheTTL: number;
}

/**
 * Create a sheetsdb client connected to a Google Spreadsheet.
 *
 * Validates the connection on init — throws SheetsdbAuthError if the
 * spreadsheet is unreachable or credentials are invalid.
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
    const message = err instanceof Error ? err.message : String(err);
    throw new SheetsdbAuthError(`Failed to connect to spreadsheet: ${message}`);
  }

  return {
    raw: doc,
    spreadsheetId,
    cacheTTL,
  };
}
