import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsvText } from './csv';
import { applyFilters, durationStats, EMPTY_FILTERS, overview, stuckKits } from './metrics';
import { buildDataset } from './process';

describe('bundled sample CSVs', () => {
  it('builds a usable ops snapshot', () => {
    const orders = parseCsvText(readFileSync('public/orders.csv', 'utf8')).rows;
    const events = parseCsvText(readFileSync('public/kit_events.csv', 'utf8')).rows;
    const data = buildDataset(orders, events);

    expect(data.orders).toHaveLength(5000);
    expect(data.quality.orphanEvents).toBe(40);
    expect(data.quality.duplicateEvents).toBeGreaterThan(0);

    const filtered = applyFilters(data.orders, EMPTY_FILTERS);
    const stuck = stuckKits(filtered, data.asOf);
    const stats = overview(data.orders, filtered, stuck);
    const hops = durationStats(filtered);

    expect(stats.finished).toBeGreaterThan(100);
    expect(stats.stuck).toBeGreaterThan(0);
    expect(stats.uploadOnly).toBeGreaterThan(0);
    expect(hops.every((h) => h.n > 0)).toBe(true);

    // Sanity snapshot for the bundled seed — keep loose so a regenerating
    // sample with the same generator still passes.
    expect(stats.kitOrders).toBeGreaterThan(3500);
    expect(stats.inFlight).toBeGreaterThan(0);
    expect(data.quality.duplicateEvents).toBeGreaterThan(200);
  });
});
