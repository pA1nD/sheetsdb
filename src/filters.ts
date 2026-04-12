/**
 * Filter evaluation — match rows against filter criteria.
 */

import { FilterOperators } from './types';

/**
 * Check whether a single field value matches a filter condition.
 * The condition can be a direct value (equality) or a FilterOperators object.
 */
export function matchesFilter(value: unknown, condition: unknown): boolean {
  // Direct equality
  if (condition === null || condition === undefined || typeof condition !== 'object' || condition instanceof Date) {
    return value === condition;
  }

  const ops = condition as FilterOperators;

  if (ops.gt !== undefined && !(value !== null && value !== undefined && (value as number) > (ops.gt as number))) return false;
  if (ops.gte !== undefined && !(value !== null && value !== undefined && (value as number) >= (ops.gte as number))) return false;
  if (ops.lt !== undefined && !(value !== null && value !== undefined && (value as number) < (ops.lt as number))) return false;
  if (ops.lte !== undefined && !(value !== null && value !== undefined && (value as number) <= (ops.lte as number))) return false;

  if (ops.contains !== undefined) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().includes(ops.contains.toLowerCase())) return false;
  }

  if (ops.startsWith !== undefined) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().startsWith(ops.startsWith.toLowerCase())) return false;
  }

  if (ops.endsWith !== undefined) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().endsWith(ops.endsWith.toLowerCase())) return false;
  }

  if (ops.isNull !== undefined) {
    const isNullish = value === null || value === undefined || value === '';
    if (ops.isNull !== isNullish) return false;
  }

  if (ops.in !== undefined) {
    if (!ops.in.includes(value as never)) return false;
  }

  if (ops.notIn !== undefined) {
    if (ops.notIn.includes(value as never)) return false;
  }

  return true;
}

/**
 * Check whether a row matches all conditions in a filter.
 */
export function matchesAllFilters(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (!matchesFilter(row[key], condition)) {
      return false;
    }
  }
  return true;
}
