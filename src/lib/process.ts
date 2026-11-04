import { daysBetween, inferAsOf, parseTimestamp } from './dates';
import { EVENT_RANK, furthestEvent, isKitProduct, stageFromEvent } from './pipeline';
import type {
  DataQuality,
  Dataset,
  HopKey,
  KitEvent,
  Order,
  ProcessedKit,
  ProcessedOrder,
  RawRow,
} from './types';

function coerceBool(value: string): boolean {
  const s = value.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function parseOrders(rows: RawRow[]): { orders: Order[]; skipped: number; duplicateOrders: number } {
  const seen = new Set<string>();
  const orders: Order[] = [];
  let skipped = 0;
  let duplicateOrders = 0;

  for (const row of rows) {
    const order_id = (row.order_id ?? '').trim();
    const created_at = parseTimestamp(row.created_at ?? '');
    if (!order_id || !created_at) {
      skipped += 1;
      continue;
    }
    if (seen.has(order_id)) {
      duplicateOrders += 1;
      continue;
    }
    seen.add(order_id);
    orders.push({
      order_id,
      created_at,
      customer_id: (row.customer_id ?? '').trim(),
      product: (row.product ?? '').trim(),
      country: (row.country ?? '').trim().toUpperCase(),
      status: (row.status ?? '').trim().toLowerCase(),
      is_test: coerceBool(row.is_test ?? ''),
    });
  }

  return { orders, skipped, duplicateOrders };
}

export function parseEvents(rows: RawRow[]): { events: KitEvent[]; skipped: number } {
  const events: KitEvent[] = [];
  let skipped = 0;

  for (const row of rows) {
    const event_id = (row.event_id ?? '').trim();
    const order_id = (row.order_id ?? '').trim();
    const kit_id = (row.kit_id ?? '').trim();
    const event_type = (row.event_type ?? '').trim();
    const occurred_at = parseTimestamp(row.occurred_at ?? '');
    if (!event_id || !order_id || !kit_id || !event_type || !occurred_at) {
      skipped += 1;
      continue;
    }
    events.push({
      event_id,
      order_id,
      kit_id,
      event_type,
      occurred_at,
      source: (row.source ?? '').trim(),
    });
  }

  return { events, skipped };
}

function dedupeEvents(events: KitEvent[]): { events: KitEvent[]; duplicateEvents: number } {
  const seen = new Set<string>();
  const out: KitEvent[] = [];
  let duplicateEvents = 0;

  const sorted = [...events].sort((a, b) => {
    const t = a.occurred_at.getTime() - b.occurred_at.getTime();
    if (t !== 0) return t;
    return a.event_id.localeCompare(b.event_id);
  });

  for (const event of sorted) {
    const key = `${event.kit_id}|${event.event_type}|${event.occurred_at.toISOString()}`;
    if (seen.has(key)) {
      duplicateEvents += 1;
      continue;
    }
    seen.add(key);
    out.push(event);
  }

  return { events: out, duplicateEvents };
}

function firstOf(events: KitEvent[], type: string): KitEvent | undefined {
  return events.find((e) => e.event_type === type);
}

function firstQc(events: KitEvent[]): KitEvent | undefined {
  return events.find((e) => e.event_type === 'qc_passed' || e.event_type === 'qc_failed');
}

function hop(from: Date | undefined, to: Date | undefined): number | undefined {
  if (!from || !to) return undefined;
  const n = daysBetween(from, to);
  if (n < 0) return undefined;
  return n;
}

function kitHops(order: Order, events: KitEvent[]): Partial<Record<HopKey, number>> {
  const shipped = firstOf(events, 'kit_shipped');
  const delivered = firstOf(events, 'kit_delivered');
  const mailed = firstOf(events, 'sample_mailed');
  const received = firstOf(events, 'sample_received');
  const qc = firstQc(events);
  const sequenced = firstOf(events, 'sequencing_complete');
  const report = firstOf(events, 'report_ready');
  const qcPassed = firstOf(events, 'qc_passed');

  return {
    order_to_ship: hop(order.created_at, shipped?.occurred_at),
    ship_to_deliver: hop(shipped?.occurred_at, delivered?.occurred_at),
    deliver_to_mail: hop(delivered?.occurred_at, mailed?.occurred_at),
    mail_to_receive: hop(mailed?.occurred_at, received?.occurred_at),
    receive_to_qc: hop(received?.occurred_at, qc?.occurred_at),
    qc_to_seq: hop(qcPassed?.occurred_at, sequenced?.occurred_at),
    seq_to_report: hop(sequenced?.occurred_at, report?.occurred_at),
  };
}

function processKit(order: Order, kitId: string, rawEvents: KitEvent[]): ProcessedKit {
  const events = [...rawEvents].sort((a, b) => {
    const t = a.occurred_at.getTime() - b.occurred_at.getTime();
    if (t !== 0) return t;
    return (EVENT_RANK[a.event_type] ?? 0) - (EVENT_RANK[b.event_type] ?? 0);
  });

  const lastEvent = furthestEvent(events);
  const replaced = events.some((e) => e.event_type === 'kit_replaced');
  const complete = events.some((e) => e.event_type === 'report_ready');
  const currentStage = replaced && !complete ? 'replaced' : stageFromEvent(lastEvent?.event_type ?? null);
  const stageEnteredAt = lastEvent?.occurred_at ?? (currentStage === 'awaiting_shipment' ? order.created_at : null);

  return {
    kit_id: kitId,
    order_id: order.order_id,
    events,
    replaced,
    complete,
    currentStage,
    lastEvent,
    stageEnteredAt,
    hops: kitHops(order, events),
  };
}

function processOrder(order: Order, eventsByKit: Map<string, KitEvent[]>): ProcessedOrder {
  const kits = [...eventsByKit.entries()]
    .map(([kitId, events]) => processKit(order, kitId, events))
    .sort((a, b) => {
      const aTime = a.events[0]?.occurred_at.getTime() ?? 0;
      const bTime = b.events[0]?.occurred_at.getTime() ?? 0;
      return aTime - bTime;
    });

  const finished = kits.some((k) => k.complete);
  const activeKit =
    kits.find((k) => !k.replaced && !k.complete) ??
    kits.find((k) => k.complete) ??
    kits.at(-1) ??
    null;

  if (!isKitProduct(order.product)) {
    return {
      order,
      kits,
      activeKit,
      currentStage: 'upload_only',
      finished: false,
      stageEnteredAt: order.created_at,
    };
  }

  if (!activeKit) {
    return {
      order,
      kits,
      activeKit: null,
      currentStage: 'awaiting_shipment',
      finished: false,
      stageEnteredAt: order.created_at,
    };
  }

  return {
    order,
    kits,
    activeKit,
    currentStage: activeKit.currentStage,
    finished,
    stageEnteredAt: activeKit.stageEnteredAt ?? order.created_at,
  };
}

export function buildDataset(orderRows: RawRow[], eventRows: RawRow[]): Dataset {
  const parsedOrders = parseOrders(orderRows);
  const parsedEvents = parseEvents(eventRows);
  const deduped = dedupeEvents(parsedEvents.events);

  const orderIds = new Set(parsedOrders.orders.map((o) => o.order_id));
  const knownEvents: KitEvent[] = [];
  let orphanEvents = 0;
  let unknownEventTypes = 0;

  for (const event of deduped.events) {
    if (!orderIds.has(event.order_id)) {
      orphanEvents += 1;
      continue;
    }
    if (!(event.event_type in EVENT_RANK)) unknownEventTypes += 1;
    knownEvents.push(event);
  }

  const eventsByOrder = new Map<string, Map<string, KitEvent[]>>();
  for (const event of knownEvents) {
    let byKit = eventsByOrder.get(event.order_id);
    if (!byKit) {
      byKit = new Map();
      eventsByOrder.set(event.order_id, byKit);
    }
    const list = byKit.get(event.kit_id) ?? [];
    list.push(event);
    byKit.set(event.kit_id, list);
  }

  const orders = parsedOrders.orders.map((order) =>
    processOrder(order, eventsByOrder.get(order.order_id) ?? new Map()),
  );

  const asOf = inferAsOf(parsedOrders.orders, knownEvents);
  const products = [...new Set(parsedOrders.orders.map((o) => o.product).filter(Boolean))].sort();
  const countries = [...new Set(parsedOrders.orders.map((o) => o.country).filter(Boolean))].sort();

  const quality: DataQuality = {
    orderRows: orderRows.length,
    eventRows: eventRows.length,
    ordersSkipped: parsedOrders.skipped,
    eventsSkipped: parsedEvents.skipped,
    duplicateEvents: deduped.duplicateEvents,
    orphanEvents,
    unknownEventTypes,
    duplicateOrders: parsedOrders.duplicateOrders,
  };

  return { orders, quality, asOf, products, countries };
}
