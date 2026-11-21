import { describe, expect, it } from 'vitest';
import { sortStuck, stuckByStage, stuckToCsv } from './export';
import { stuckKits } from './metrics';
import { buildDataset } from './process';

const AS_OF = new Date('2026-10-20T00:00:00Z');

function data() {
  const orders = [
    { order_id: 'o1', created_at: '2026-08-01T00:00:00Z', customer_id: 'c,1', product: 'wgs_30x', country: 'US', status: 'paid', is_test: 'false' },
    { order_id: 'o2', created_at: '2026-10-01T00:00:00Z', customer_id: 'c2', product: 'wgs_100x', country: 'DE', status: 'paid', is_test: 'false' },
    { order_id: 'o3', created_at: '2026-09-01T00:00:00Z', customer_id: 'c3', product: 'wgs_30x', country: 'CA', status: 'paid', is_test: 'false' },
  ];
  const events = [
    { event_id: 'e1', order_id: 'o1', kit_id: 'k1', event_type: 'kit_delivered', occurred_at: '2026-08-05T00:00:00Z', source: 'carrier' },
    { event_id: 'e3', order_id: 'o3', kit_id: 'k3', event_type: 'kit_shipped', occurred_at: '2026-09-02T00:00:00Z', source: 'system' },
  ];
  return stuckKits(buildDataset(orders, events).orders, AS_OF);
}

describe('stuck list helpers', () => {
  it('sorts by the chosen column', () => {
    const rows = data();
    expect(sortStuck(rows, 'overdue').map((r) => r.order.order.order_id)).toEqual(['o3', 'o1', 'o2']);
    expect(sortStuck(rows, 'country').map((r) => r.order.order.country)).toEqual(['CA', 'DE', 'US']);
    expect(sortStuck(rows, 'stage').map((r) => r.stage)).toEqual(['awaiting_shipment', 'in_transit', 'awaiting_sample']);
    expect(sortStuck(rows, 'days')[0].order.order.order_id).toBe('o1');
  });

  it('groups counts by stage in pipeline order', () => {
    expect(stuckByStage(data())).toEqual([
      { stage: 'awaiting_shipment', count: 1 },
      { stage: 'in_transit', count: 1 },
      { stage: 'awaiting_sample', count: 1 },
    ]);
  });

  it('exports CSV with a header and escapes commas', () => {
    const csv = stuckToCsv(sortStuck(data(), 'overdue'));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(
      'order_id,kit_id,customer_id,product,country,stage,stage_entered_at,days_in_stage,target_days,days_overdue',
    );
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('"c,1"');
    expect(lines[1]).toBe('o3,k3,c3,wgs_30x,CA,In transit to customer,2026-09-02T00:00:00.000Z,48.0,7,41.0');
  });
});
