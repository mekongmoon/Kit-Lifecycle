import Papa from 'papaparse';
import type { RawRow } from './types';

export type FileKind = 'orders' | 'events' | 'unknown';

export function parseCsvText(text: string): { rows: RawRow[]; headers: string[]; errors: string[] } {
  const cleaned = text.replace(/^\uFEFF/, '');
  const result = Papa.parse<RawRow>(cleaned, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  const rows = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== ''),
  );
  const errors = (result.errors ?? [])
    .filter((e) => e.type === 'Quotes' || e.type === 'FieldMismatch')
    .slice(0, 8)
    .map((e) => `Row ${e.row ?? '?'}: ${e.message}`);

  return { rows, headers, errors };
}

export function detectKind(headers: string[]): FileKind {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  const looksOrders = set.has('order_id') && (set.has('product') || set.has('customer_id') || set.has('created_at'));
  const looksEvents = set.has('event_type') && (set.has('kit_id') || set.has('occurred_at'));
  if (looksOrders && !looksEvents) return 'orders';
  if (looksEvents && !looksOrders) return 'events';
  if (looksEvents && set.has('kit_id')) return 'events';
  if (looksOrders) return 'orders';
  return 'unknown';
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}
