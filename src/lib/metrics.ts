import { daysBetween, endOfUtcDay, startOfUtcDay } from './dates';
import { HOPS, isKitProduct, STAGE_ORDER, STUCK_TARGET } from './pipeline';
import type { Filters, HopKey, ProcessedOrder, StageKey, StuckRow } from './types';

export const EMPTY_FILTERS: Filters = {
  from: '',
  to: '',
  product: 'all',
  country: 'all',
  includeTest: false,
  includeInactive: false,
};

export function applyFilters(orders: ProcessedOrder[], filters: Filters): ProcessedOrder[] {
  const from = filters.from ? startOfUtcDay(filters.from) : null;
  const to = filters.to ? endOfUtcDay(filters.to) : null;

  return orders.filter((item) => {
    const { order } = item;
    if (!filters.includeTest && order.is_test) return false;
    if (!filters.includeInactive && (order.status === 'cancelled' || order.status === 'refunded')) {
      return false;
    }
    if (filters.product !== 'all' && order.product !== filters.product) return false;
    if (filters.country !== 'all' && order.country !== filters.country) return false;
    if (from && order.created_at < from) return false;
    if (to && order.created_at > to) return false;
    return true;
  });
}

export function pipelineCounts(orders: ProcessedOrder[]): { stage: StageKey; count: number }[] {
  const counts = new Map<StageKey, number>();
  for (const stage of STAGE_ORDER) counts.set(stage, 0);

  for (const item of orders) {
    if (!isKitProduct(item.order.product)) continue;
    const stage = item.currentStage;
    if (stage === 'replaced' || stage === 'upload_only' || stage === 'no_kit') continue;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }

  return STAGE_ORDER.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

export type HopStats = {
  key: HopKey;
  label: string;
  targetDays: number;
  n: number;
  p50: number | null;
  p90: number | null;
  byProduct: { product: string; n: number; p50: number | null }[];
};

export function durationStats(orders: ProcessedOrder[]): HopStats[] {
  const products = [...new Set(orders.map((o) => o.order.product).filter(isKitProduct))].sort();

  return HOPS.map((hop) => {
    const all: number[] = [];
    const grouped = new Map<string, number[]>();
    for (const product of products) grouped.set(product, []);

    for (const item of orders) {
      if (!isKitProduct(item.order.product)) continue;
      for (const kit of item.kits) {
        const value = kit.hops[hop.key];
        if (value === undefined) continue;
        all.push(value);
        grouped.get(item.order.product)?.push(value);
      }
    }

    return {
      key: hop.key,
      label: hop.label,
      targetDays: hop.targetDays,
      n: all.length,
      p50: quantile(all, 0.5),
      p90: quantile(all, 0.9),
      byProduct: products.map((product) => {
        const values = grouped.get(product) ?? [];
        return { product, n: values.length, p50: quantile(values, 0.5) };
      }),
    };
  });
}

export function isActionable(item: ProcessedOrder): boolean {
  return item.order.status === 'paid' && isKitProduct(item.order.product) && !item.finished;
}

export function stuckKits(orders: ProcessedOrder[], asOf: Date): StuckRow[] {
  const rows: StuckRow[] = [];

  for (const item of orders) {
    if (!isActionable(item)) continue;
    const stage = item.currentStage;
    if (stage === 'upload_only' || stage === 'no_kit' || stage === 'complete' || stage === 'replaced') {
      continue;
    }
    const target = STUCK_TARGET[stage];
    if (target === null) continue;
    const enteredAt = item.stageEnteredAt ?? item.order.created_at;
    const daysInStage = daysBetween(enteredAt, asOf);
    if (daysInStage <= target) continue;
    rows.push({
      order: item,
      kit: item.activeKit,
      stage,
      enteredAt,
      daysInStage,
      targetDays: target,
      overdueBy: daysInStage - target,
    });
  }

  return rows.sort((a, b) => b.overdueBy - a.overdueBy);
}

export type Overview = {
  orders: number;
  kitOrders: number;
  uploadOnly: number;
  inFlight: number;
  finished: number;
  stuck: number;
  replacements: number;
  testExcluded: number;
};

export function overview(all: ProcessedOrder[], filtered: ProcessedOrder[], stuck: StuckRow[]): Overview {
  let kitOrders = 0;
  let uploadOnly = 0;
  let inFlight = 0;
  let finished = 0;
  let replacements = 0;

  for (const item of filtered) {
    if (item.order.product === 'upload_only') {
      uploadOnly += 1;
      continue;
    }
    kitOrders += 1;
    if (item.finished) finished += 1;
    else if (item.order.status === 'paid') inFlight += 1;
    replacements += item.kits.filter((k) => k.replaced).length;
  }

  return {
    orders: filtered.length,
    kitOrders,
    uploadOnly,
    inFlight,
    finished,
    stuck: stuck.length,
    replacements,
    testExcluded: all.filter((o) => o.order.is_test).length,
  };
}

export function searchOrders(orders: ProcessedOrder[], query: string): ProcessedOrder[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ProcessedOrder[] = [];
  for (const item of orders) {
    if (
      item.order.order_id.toLowerCase().includes(q) ||
      item.order.customer_id.toLowerCase().includes(q) ||
      item.kits.some((k) => k.kit_id.toLowerCase().includes(q))
    ) {
      hits.push(item);
      if (hits.length >= 40) break;
    }
  }
  return hits;
}

export type WeekTrend = {
  /** Monday of the ISO week, YYYY-MM-DD (UTC). */
  week: string;
  /** Kit orders created this week. */
  ordersPlaced: number;
  /** Kit orders whose first report landed this week. */
  reportsReady: number;
  /** Median calendar days from order to report, for reports ready this week. */
  medianDaysToReport: number | null;
};

export function weekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** Weekly volume and turnaround for kit orders, oldest week first, with empty weeks filled in. */
export function weeklyTrends(orders: ProcessedOrder[]): WeekTrend[] {
  const placed = new Map<string, number>();
  const turnaround = new Map<string, number[]>();

  for (const item of orders) {
    if (!isKitProduct(item.order.product)) continue;
    const created = weekStart(item.order.created_at);
    placed.set(created, (placed.get(created) ?? 0) + 1);

    const reportTimes = item.kits
      .flatMap((k) => k.events)
      .filter((e) => e.event_type === 'report_ready')
      .map((e) => e.occurred_at.getTime());
    if (reportTimes.length === 0) continue;
    const reportAt = new Date(Math.min(...reportTimes));
    const days = daysBetween(item.order.created_at, reportAt);
    if (days < 0) continue;
    const week = weekStart(reportAt);
    const list = turnaround.get(week) ?? [];
    list.push(days);
    turnaround.set(week, list);
  }

  const weeks = [...placed.keys(), ...turnaround.keys()].sort();
  if (weeks.length === 0) return [];

  const out: WeekTrend[] = [];
  const end = new Date(`${weeks.at(-1)}T00:00:00Z`).getTime();
  for (let t = new Date(`${weeks[0]}T00:00:00Z`).getTime(); t <= end; t += 7 * 86_400_000) {
    const week = new Date(t).toISOString().slice(0, 10);
    const done = turnaround.get(week) ?? [];
    out.push({
      week,
      ordersPlaced: placed.get(week) ?? 0,
      reportsReady: done.length,
      medianDaysToReport: quantile(done, 0.5),
    });
  }
  return out;
}
