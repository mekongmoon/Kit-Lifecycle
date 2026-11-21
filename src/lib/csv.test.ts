import { describe, expect, it } from 'vitest';
import { checkUploads, detectKind, parseCsvText } from './csv';

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

describe('checkUploads', () => {
  const ordersHeaders = ['order_id', 'created_at', 'customer_id', 'product', 'country', 'status', 'is_test'];
  const eventsHeaders = ['event_id', 'order_id', 'kit_id', 'event_type', 'occurred_at', 'source'];
  const file = (name: string, headers: string[], rows = [{ a: '1' }]) => ({ name, headers, rows, errors: [] });

  it('accepts a valid pair', () => {
    const res = checkUploads([file('a.csv', ordersHeaders), file('b.csv', eventsHeaders)]);
    expect(res.errors).toEqual([]);
    expect(res.orders).toHaveLength(1);
    expect(res.events).toHaveLength(1);
  });

  it('names missing required columns', () => {
    const res = checkUploads([file('o.csv', ['order_id', 'product', 'customer_id'])]);
    expect(res.errors[0]).toContain('missing: created_at, status');
    expect(res.orders).toBeUndefined();
  });

  it('rejects two files of the same kind', () => {
    const res = checkUploads([file('a.csv', ordersHeaders), file('b.csv', ordersHeaders)]);
    expect(res.errors[0]).toContain('both look like orders files');
  });

  it('flags empty and header-only files', () => {
    expect(checkUploads([file('e.csv', [], [])]).errors[0]).toContain('empty');
    expect(checkUploads([file('h.csv', eventsHeaders, [])]).warnings[0]).toContain('no data rows');
  });

  it('reports unknown files with the columns it found', () => {
    expect(checkUploads([file('x.csv', ['foo', 'bar'])]).errors[0]).toContain('Found columns: foo, bar');
  });
});
