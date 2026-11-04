import type { HopKey, KitEvent, StageKey } from './types';

export const PIPELINE_EVENTS = [
  'kit_shipped',
  'kit_delivered',
  'sample_mailed',
  'sample_received',
  'qc_passed',
  'qc_failed',
  'sequencing_complete',
  'report_ready',
  'kit_replaced',
] as const;

export const EVENT_RANK: Record<string, number> = {
  kit_shipped: 1,
  kit_delivered: 2,
  sample_mailed: 3,
  sample_received: 4,
  qc_passed: 5,
  qc_failed: 5,
  sequencing_complete: 6,
  report_ready: 7,
  kit_replaced: 8,
};

export const STAGE_LABEL: Record<StageKey, string> = {
  awaiting_shipment: 'Awaiting shipment',
  in_transit: 'In transit to customer',
  awaiting_sample: 'Awaiting sample',
  sample_in_transit: 'Sample in transit',
  at_lab: 'At lab (pre-QC)',
  qc_failed: 'QC failed',
  sequencing: 'Sequencing',
  reporting: 'Report generation',
  complete: 'Report ready',
  replaced: 'Replaced',
};

export const STAGE_ORDER: StageKey[] = [
  'awaiting_shipment',
  'in_transit',
  'awaiting_sample',
  'sample_in_transit',
  'at_lab',
  'qc_failed',
  'sequencing',
  'reporting',
  'complete',
];

export const HOPS: {
  key: HopKey;
  label: string;
  targetDays: number;
}[] = [
  { key: 'order_to_ship', label: 'Order → shipped', targetDays: 3 },
  { key: 'ship_to_deliver', label: 'Shipped → delivered', targetDays: 7 },
  { key: 'deliver_to_mail', label: 'Delivered → mailed', targetDays: 45 },
  { key: 'mail_to_receive', label: 'Mailed → received', targetDays: 14 },
  { key: 'receive_to_qc', label: 'Received → QC', targetDays: 7 },
  { key: 'qc_to_seq', label: 'QC passed → sequenced', targetDays: 28 },
  { key: 'seq_to_report', label: 'Sequenced → report', targetDays: 5 },
];

/** Days allowed in the current stage before the kit is flagged for follow-up. */
export const STUCK_TARGET: Record<StageKey, number | null> = {
  awaiting_shipment: 3,
  in_transit: 7,
  awaiting_sample: 45,
  sample_in_transit: 14,
  at_lab: 7,
  // Not in the brief; ops still needs a clock after a failed QC.
  qc_failed: 7,
  sequencing: 28,
  reporting: 5,
  complete: null,
  replaced: null,
};

export function isKitProduct(product: string): boolean {
  return product !== 'upload_only';
}

export function stageFromEvent(type: string | null): StageKey {
  switch (type) {
    case 'kit_shipped':
      return 'in_transit';
    case 'kit_delivered':
      return 'awaiting_sample';
    case 'sample_mailed':
      return 'sample_in_transit';
    case 'sample_received':
      return 'at_lab';
    case 'qc_failed':
      return 'qc_failed';
    case 'qc_passed':
      return 'sequencing';
    case 'sequencing_complete':
      return 'reporting';
    case 'report_ready':
      return 'complete';
    case 'kit_replaced':
      return 'replaced';
    default:
      return 'awaiting_shipment';
  }
}

export function furthestEvent(events: KitEvent[]): KitEvent | null {
  let best: KitEvent | null = null;
  let bestRank = 0;
  for (const event of events) {
    const rank = EVENT_RANK[event.event_type] ?? 0;
    if (!rank) continue;
    if (rank > bestRank) {
      best = event;
      bestRank = rank;
      continue;
    }
    if (rank === bestRank && best && event.occurred_at > best.occurred_at) {
      best = event;
    }
  }
  return best;
}

export function productLabel(product: string): string {
  switch (product) {
    case 'wgs_30x':
      return 'WGS 30×';
    case 'wgs_100x':
      return 'WGS 100×';
    case 'upload_only':
      return 'Upload only';
    default:
      return product || 'Unknown';
  }
}
