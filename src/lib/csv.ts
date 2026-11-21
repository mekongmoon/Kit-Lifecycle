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

/** Columns the dashboard cannot work without. Optional columns are filled with blanks. */
export const REQUIRED_COLUMNS: Record<Exclude<FileKind, 'unknown'>, string[]> = {
  orders: ['order_id', 'created_at', 'product', 'status'],
  events: ['order_id', 'kit_id', 'event_type', 'occurred_at'],
};

export function missingColumns(kind: Exclude<FileKind, 'unknown'>, headers: string[]): string[] {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return REQUIRED_COLUMNS[kind].filter((col) => !set.has(col));
}

export type ParsedUpload = {
  name: string;
  rows: RawRow[];
  headers: string[];
  errors: string[];
};

export type UploadCheck = {
  orders?: RawRow[];
  events?: RawRow[];
  /** Blocking problems: nothing from this batch should be applied. */
  errors: string[];
  /** Non-blocking problems worth showing next to the data. */
  warnings: string[];
};

/** Classify a batch of uploaded files and explain anything that would stop them loading. */
export function checkUploads(files: ParsedUpload[]): UploadCheck {
  const out: UploadCheck = { errors: [], warnings: [] };
  const seen: Partial<Record<Exclude<FileKind, 'unknown'>, string>> = {};

  for (const file of files) {
    if (file.headers.length === 0) {
      out.errors.push(`${file.name} is empty or has no header row.`);
      continue;
    }
    const kind = detectKind(file.headers);
    if (kind === 'unknown') {
      out.errors.push(
        `${file.name} does not look like an orders or kit events file. ` +
          `Found columns: ${file.headers.join(', ')}.`,
      );
      continue;
    }
    const missing = missingColumns(kind, file.headers);
    if (missing.length) {
      out.errors.push(`${file.name} looks like a ${kind} file but is missing: ${missing.join(', ')}.`);
      continue;
    }
    if (seen[kind]) {
      out.errors.push(
        `${seen[kind]} and ${file.name} both look like ${kind} files. Upload one orders file and one kit events file.`,
      );
      continue;
    }
    seen[kind] = file.name;
    if (file.rows.length === 0) out.warnings.push(`${file.name} has headers but no data rows.`);
    for (const e of file.errors) out.warnings.push(`${file.name}: ${e}`);
    out[kind] = file.rows;
  }

  return out;
}
