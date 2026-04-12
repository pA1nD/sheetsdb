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
  const required = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'SPREADSHEET_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && process.env.RUN_E2E === 'true') {
    console.warn(`Missing env vars for e2e tests: ${missing.join(', ')}`);
    console.warn('Skipping e2e tests. Set these in .env to run them.');
  }
}
