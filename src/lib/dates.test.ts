import { describe, expect, it } from 'vitest';
import { daysBetween, parseTimestamp } from './dates';

describe('parseTimestamp', () => {
  it('parses Zulu, offsets, and naive UTC', () => {
    const z = parseTimestamp('2026-09-03T10:55:14Z');
    const offset = parseTimestamp('2026-09-03T10:55:14-05:00');
    const naive = parseTimestamp('2026-09-03 10:55:14');

    expect(z?.toISOString()).toBe('2026-09-03T10:55:14.000Z');
    expect(naive?.toISOString()).toBe('2026-09-03T10:55:14.000Z');
    expect(offset?.toISOString()).toBe('2026-09-03T15:55:14.000Z');
  });

  it('returns null for empty or junk values', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('uses fractional calendar days', () => {
    const a = new Date('2026-10-01T00:00:00Z');
    const b = new Date('2026-10-08T12:00:00Z');
    expect(daysBetween(a, b)).toBeCloseTo(7.5);
  });
});
