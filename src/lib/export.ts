import { STAGE_LABEL } from './pipeline';
import type { StageKey, StuckRow } from './types';

export type StuckSort = 'overdue' | 'days' | 'country' | 'stage';

const STAGE_POS: Record<StageKey, number> = {
  awaiting_shipment: 0,
  in_transit: 1,
  awaiting_sample: 2,
  sample_in_transit: 3,
  at_lab: 4,
  qc_failed: 5,
  sequencing: 6,
  reporting: 7,
  complete: 8,
  replaced: 9,
};

/** Sort a copy of the stuck list. Ties fall back to most overdue first. */
export function sortStuck(rows: StuckRow[], by: StuckSort): StuckRow[] {
  const overdue = (a: StuckRow, b: StuckRow) => b.overdueBy - a.overdueBy;
  const cmp: Record<StuckSort, (a: StuckRow, b: StuckRow) => number> = {
    overdue,
    days: (a, b) => b.daysInStage - a.daysInStage || overdue(a, b),
    country: (a, b) => a.order.order.country.localeCompare(b.order.order.country) || overdue(a, b),
    stage: (a, b) => STAGE_POS[a.stage] - STAGE_POS[b.stage] || overdue(a, b),
  };
  return [...rows].sort(cmp[by]);
}

/** Count stuck rows per stage, in pipeline order, skipping empty stages. */
export function stuckByStage(rows: StuckRow[]): { stage: StageKey; count: number }[] {
  const counts = new Map<StageKey, number>();
  for (const row of rows) counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => STAGE_POS[a[0]] - STAGE_POS[b[0]])
    .map(([stage, count]) => ({ stage, count }));
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const STUCK_CSV_HEADERS = [
  'order_id',
  'kit_id',
  'customer_id',
  'product',
  'country',
  'stage',
  'stage_entered_at',
  'days_in_stage',
  'target_days',
  'days_overdue',
];

export function stuckToCsv(rows: StuckRow[]): string {
  const lines = [STUCK_CSV_HEADERS.join(',')];
  for (const row of rows) {
    const { order } = row.order;
    lines.push(
      [
        order.order_id,
        row.kit?.kit_id ?? '',
        order.customer_id,
        order.product,
        order.country,
        STAGE_LABEL[row.stage],
        row.enteredAt.toISOString(),
        row.daysInStage.toFixed(1),
        row.targetDays,
        row.overdueBy.toFixed(1),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
