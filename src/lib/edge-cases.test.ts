import { describe, expect, it } from 'vitest';
import { SAMPLE_AS_OF } from './dates';
import { pipelineCounts, stuckKits } from './metrics';
import { buildDataset } from './process';

const AS_OF = new Date('2026-10-20T00:00:00Z');

function order(overrides: Record<string, string> = {}) {
  return {
    order_id: 'ord_1',
    created_at: '2026-09-01T00:00:00Z',
    customer_id: 'cus_1',
    product: 'wgs_30x',
    country: 'US',
    status: 'paid',
    is_test: 'false',
    ...overrides,
  };
}

let seq = 0;
function ev(event_type: string, occurred_at: string, overrides: Record<string, string> = {}) {
  seq += 1;
  return {
    event_id: `evt_${seq}`,
    order_id: 'ord_1',
    kit_id: 'kit_1',
    event_type,
    occurred_at,
    source: 'system',
    ...overrides,
  };
}

describe('out-of-order and contradictory events', () => {
  it('uses pipeline order, not timestamp order, for the current stage', () => {
    const data = buildDataset(
      [order()],
      [
        ev('kit_shipped', '2026-09-02T00:00:00Z'),
        ev('sample_received', '2026-09-05T00:00:00Z'),
        ev('kit_delivered', '2026-09-08T00:00:00Z'),
      ],
    );
    expect(data.orders[0].currentStage).toBe('at_lab');
    expect(data.orders[0].kits[0].hops.ship_to_deliver).toBe(6);
  });

  it('drops negative durations instead of reporting them', () => {
    const data = buildDataset(
      [order()],
      [
        ev('kit_shipped', '2026-08-30T00:00:00Z'), // before the order was created
        ev('kit_delivered', '2026-09-05T00:00:00Z'),
        ev('sample_mailed', '2026-09-04T00:00:00Z'), // before delivery
      ],
    );
    const { hops } = data.orders[0].kits[0];
    expect(hops.order_to_ship).toBeUndefined();
    expect(hops.ship_to_deliver).toBe(6);
    expect(hops.deliver_to_mail).toBeUndefined();
  });

  it('treats a QC retest that passes as sequencing', () => {
    const data = buildDataset(
      [order()],
      [
        ev('sample_received', '2026-09-10T00:00:00Z'),
        ev('qc_failed', '2026-09-12T00:00:00Z'),
        ev('qc_passed', '2026-09-15T00:00:00Z'),
      ],
    );
    const kit = data.orders[0].kits[0];
    expect(data.orders[0].currentStage).toBe('sequencing');
    // Received → QC measures the first result; QC passed → sequenced starts at the pass.
    expect(kit.hops.receive_to_qc).toBe(2);
  });

  it('uses the latest QC result when a pass is followed by a fail', () => {
    const data = buildDataset(
      [order()],
      [ev('qc_passed', '2026-09-12T00:00:00Z'), ev('qc_failed', '2026-09-14T00:00:00Z')],
    );
    expect(data.orders[0].currentStage).toBe('qc_failed');
  });
});

describe('events around report_ready and replacements', () => {
  it('keeps a kit complete if kit_replaced is logged after its report', () => {
    const data = buildDataset(
      [order()],
      [ev('report_ready', '2026-10-01T00:00:00Z'), ev('kit_replaced', '2026-10-03T00:00:00Z')],
    );
    expect(data.orders[0].currentStage).toBe('complete');
    expect(data.orders[0].finished).toBe(true);
    expect(pipelineCounts(data.orders).find((c) => c.stage === 'complete')?.count).toBe(1);
  });

  it('ignores later scans on a replaced kit when picking the active kit', () => {
    const data = buildDataset(
      [order()],
      [
        ev('kit_shipped', '2026-09-02T00:00:00Z'),
        ev('kit_replaced', '2026-09-10T00:00:00Z'),
        ev('kit_delivered', '2026-09-12T00:00:00Z'), // late carrier scan on the old kit
        ev('kit_shipped', '2026-09-11T00:00:00Z', { kit_id: 'kit_2' }),
      ],
    );
    expect(data.orders[0].activeKit?.kit_id).toBe('kit_2');
    expect(data.orders[0].currentStage).toBe('in_transit');
  });

  it('reports the finished kit when an original kit completes after a replacement was sent', () => {
    const data = buildDataset(
      [order({ created_at: '2026-07-01T00:00:00Z' })],
      [
        ev('kit_shipped', '2026-07-02T00:00:00Z'),
        ev('kit_replaced', '2026-07-20T00:00:00Z'),
        ev('kit_shipped', '2026-07-21T00:00:00Z', { kit_id: 'kit_2' }),
        ev('report_ready', '2026-09-01T00:00:00Z'),
      ],
    );
    const item = data.orders[0];
    expect(item.finished).toBe(true);
    expect(item.activeKit?.kit_id).toBe('kit_1');
    expect(item.currentStage).toBe('complete');
    expect(stuckKits(data.orders, AS_OF)).toHaveLength(0);
  });
});

describe('formatting quirks', () => {
  it('reads date-only timestamps as UTC midnight', () => {
    const data = buildDataset(
      [order({ created_at: '2026-09-01' })],
      [ev('kit_shipped', '2026-09-03')],
    );
    expect(data.orders[0].kits[0].hops.order_to_ship).toBe(2);
  });

  it('normalizes case and whitespace in event_type and product', () => {
    const data = buildDataset(
      [order({ product: ' WGS_30X ' })],
      [ev(' Kit_Shipped ', '2026-09-02T00:00:00Z')],
    );
    expect(data.orders[0].order.product).toBe('wgs_30x');
    expect(data.orders[0].currentStage).toBe('in_transit');
    expect(data.quality.unknownEventTypes).toBe(0);
  });

  it('handles empty inputs', () => {
    const data = buildDataset([], []);
    expect(data.orders).toEqual([]);
    expect(data.asOf).toEqual(SAMPLE_AS_OF);
    expect(data.quality.issueCount).toBe(0);
  });

  it('keeps kit orders with no events in awaiting shipment', () => {
    const data = buildDataset([order({ created_at: '2026-10-01T00:00:00Z' })], []);
    expect(data.orders[0].currentStage).toBe('awaiting_shipment');
    expect(stuckKits(data.orders, AS_OF)[0]?.stage).toBe('awaiting_shipment');
  });
});
