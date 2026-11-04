import { describe, expect, it } from 'vitest';
import { stuckKits } from './metrics';
import { buildDataset } from './process';

function orderRow(overrides: Record<string, string> = {}) {
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

function eventRow(overrides: Record<string, string> = {}) {
  return {
    event_id: 'evt_1',
    order_id: 'ord_1',
    kit_id: 'kit_1',
    event_type: 'kit_shipped',
    occurred_at: '2026-09-02T00:00:00Z',
    source: 'system',
    ...overrides,
  };
}

describe('buildDataset', () => {
  it('drops duplicate events and orphan rows', () => {
    const data = buildDataset(
      [orderRow()],
      [
        eventRow(),
        eventRow({ event_id: 'evt_dup' }),
        eventRow({
          event_id: 'evt_orphan',
          order_id: 'ord_missing',
          kit_id: 'kit_x',
        }),
      ],
    );

    expect(data.quality.duplicateEvents).toBe(1);
    expect(data.quality.orphanEvents).toBe(1);
    expect(data.orders[0].kits[0].events).toHaveLength(1);
  });

  it('does not regress when a later scan is missing', () => {
    const data = buildDataset(
      [orderRow()],
      [
        eventRow(),
        eventRow({
          event_id: 'evt_2',
          event_type: 'sample_mailed',
          occurred_at: '2026-09-10T00:00:00Z',
          source: 'carrier',
        }),
      ],
    );

    expect(data.orders[0].currentStage).toBe('sample_in_transit');
    expect(data.orders[0].kits[0].hops.ship_to_deliver).toBeUndefined();
    expect(data.orders[0].kits[0].hops.deliver_to_mail).toBeUndefined();
  });

  it('treats a replacement as the active kit', () => {
    const data = buildDataset(
      [orderRow()],
      [
        eventRow(),
        eventRow({
          event_id: 'evt_r',
          event_type: 'kit_replaced',
          occurred_at: '2026-09-05T00:00:00Z',
        }),
        eventRow({
          event_id: 'evt_2',
          kit_id: 'kit_2',
          event_type: 'kit_shipped',
          occurred_at: '2026-09-06T00:00:00Z',
        }),
      ],
    );

    expect(data.orders[0].kits).toHaveLength(2);
    expect(data.orders[0].activeKit?.kit_id).toBe('kit_2');
    expect(data.orders[0].currentStage).toBe('in_transit');
  });

  it('keeps upload-only orders out of the kit pipeline', () => {
    const data = buildDataset([orderRow({ product: 'upload_only' })], []);
    expect(data.orders[0].currentStage).toBe('upload_only');
    expect(data.orders[0].kits).toHaveLength(0);
  });

  it('parses mixed timestamp formats onto the same kit', () => {
    const data = buildDataset(
      [orderRow()],
      [
        eventRow({ occurred_at: '2026-09-02 00:00:00' }),
        eventRow({
          event_id: 'evt_2',
          event_type: 'kit_delivered',
          occurred_at: '2026-09-06T00:00:00-04:00',
        }),
      ],
    );
    expect(data.orders[0].kits[0].events).toHaveLength(2);
    expect(data.orders[0].currentStage).toBe('awaiting_sample');
  });
});

describe('stuckKits', () => {
  it('flags a kit waiting past the stage target', () => {
    const data = buildDataset(
      [orderRow({ created_at: '2026-08-01T00:00:00Z' })],
      [
        eventRow({
          event_type: 'kit_delivered',
          occurred_at: '2026-08-05T00:00:00Z',
        }),
      ],
    );
    const asOf = new Date('2026-10-20T00:00:00Z');
    const stuck = stuckKits(data.orders, asOf);
    expect(stuck).toHaveLength(1);
    expect(stuck[0].stage).toBe('awaiting_sample');
    expect(stuck[0].overdueBy).toBeGreaterThan(0);
  });

  it('does not flag refunded orders for follow-up', () => {
    const data = buildDataset(
      [orderRow({ status: 'refunded', created_at: '2026-08-01T00:00:00Z' })],
      [eventRow({ occurred_at: '2026-08-02T00:00:00Z' })],
    );
    expect(stuckKits(data.orders, new Date('2026-10-20T00:00:00Z'))).toHaveLength(0);
  });
});
