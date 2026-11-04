import { describe, expect, it } from 'vitest';
import { detectKind, parseCsvText } from './csv';

describe('parseCsvText', () => {
  it('reads headers and skips blank rows', () => {
    const text = 'order_id,product\nord_1,wgs_30x\n,\n';
    const parsed = parseCsvText(text);
    expect(parsed.headers).toEqual(['order_id', 'product']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].order_id).toBe('ord_1');
  });

  it('strips a BOM', () => {
    const parsed = parseCsvText('\uFEFForder_id,product\nord_1,wgs_30x\n');
    expect(parsed.headers[0]).toBe('order_id');
  });
});

describe('detectKind', () => {
  it('classifies orders vs events by columns', () => {
    expect(detectKind(['order_id', 'product', 'customer_id'])).toBe('orders');
    expect(detectKind(['event_id', 'event_type', 'kit_id', 'occurred_at'])).toBe('events');
    expect(detectKind(['foo', 'bar'])).toBe('unknown');
  });
});
