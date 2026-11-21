import { describe, expect, it } from 'vitest';
import { weeklyTrends } from './metrics';
import { buildDataset } from './process';

const order = (o: Record<string, string>) => ({
  order_id: 'ord_1',
  created_at: '2026-09-01T00:00:00Z',
  customer_id: 'cus_1',
  product: 'wgs_30x',
  country: 'US',
  status: 'paid',
  is_test: 'false',
  ...o,
});

const ev = (event_type: string, occurred_at: string, o: Record<string, string>) => ({
  event_id: `${o.order_id}_${event_type}`,
  order_id: 'ord_1',
  kit_id: 'kit_1',
  event_type,
  occurred_at,
  source: 'lab',
  ...o,
});

describe('weeklyTrends', () => {
  it('buckets by ISO week, fills gaps, and measures order-to-report time', () => {
    const data = buildDataset(
      [
        order({ order_id: 'a', created_at: '2026-09-02T00:00:00Z' }), // Wed, week of 08-31
        order({ order_id: 'b', created_at: '2026-09-06T23:00:00Z' }), // Sun, same week
        order({ order_id: 'c', created_at: '2026-09-20T00:00:00Z', product: 'upload_only' }),
      ],
      [ev('report_ready', '2026-09-16T00:00:00Z', { order_id: 'a', kit_id: 'ka' })],
    );
    const trends = weeklyTrends(data.orders);
    expect(trends.map((t) => t.week)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14']);
    expect(trends[0].ordersPlaced).toBe(2);
    expect(trends[1]).toEqual({ week: '2026-09-07', ordersPlaced: 0, reportsReady: 0, medianDaysToReport: null });
    expect(trends[2].reportsReady).toBe(1);
    expect(trends[2].medianDaysToReport).toBe(14);
  });

  it('returns nothing for an empty dataset', () => {
    expect(weeklyTrends([])).toEqual([]);
  });
});
