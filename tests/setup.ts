/**
 * Global test setup for sheetsdb.
 *
 * This file runs before all tests. It loads environment variables
 * and sets up any shared test state.
 */

import * as dotenv from 'dotenv';

dotenv.config();

export default async function setup(): Promise<void> {
  // Validate required env vars for e2e tests
  const required = ['SHEETSDB_TEST_CLIENT_EMAIL', 'SHEETSDB_TEST_PRIVATE_KEY', 'SHEETSDB_TEST_SPREADSHEET_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && process.env.RUN_E2E === 'true') {
    throw new Error(`Missing required env vars for e2e tests: ${missing.join(', ')}`);
  }
}
