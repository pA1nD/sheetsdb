/**
 * Shared test helpers and utilities.
 */

/**
 * Generate a unique test sheet name to avoid collisions between test runs.
 */
export function testSheetName(prefix: string): string {
  return `${prefix}_test_${Date.now()}`;
}
