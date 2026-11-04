export type RawRow = Record<string, string>;

export type Order = {
  order_id: string;
  created_at: Date;
  customer_id: string;
  product: string;
  country: string;
  status: string;
  is_test: boolean;
};

export type KitEvent = {
  event_id: string;
  order_id: string;
  kit_id: string;
  event_type: string;
  occurred_at: Date;
  source: string;
};

export type StageKey =
  | 'awaiting_shipment'
  | 'in_transit'
  | 'awaiting_sample'
  | 'sample_in_transit'
  | 'at_lab'
  | 'qc_failed'
  | 'sequencing'
  | 'reporting'
  | 'complete'
  | 'replaced';

export type HopKey =
  | 'order_to_ship'
  | 'ship_to_deliver'
  | 'deliver_to_mail'
  | 'mail_to_receive'
  | 'receive_to_qc'
  | 'qc_to_seq'
  | 'seq_to_report';

export type ProcessedKit = {
  kit_id: string;
  order_id: string;
  events: KitEvent[];
  replaced: boolean;
  complete: boolean;
  currentStage: StageKey;
  lastEvent: KitEvent | null;
  stageEnteredAt: Date | null;
  hops: Partial<Record<HopKey, number>>;
};

export type OrderKind = StageKey | 'upload_only' | 'no_kit';

export type ProcessedOrder = {
  order: Order;
  kits: ProcessedKit[];
  activeKit: ProcessedKit | null;
  currentStage: OrderKind;
  finished: boolean;
  stageEnteredAt: Date | null;
};

export type DataQuality = {
  orderRows: number;
  eventRows: number;
  ordersSkipped: number;
  eventsSkipped: number;
  duplicateEvents: number;
  orphanEvents: number;
  unknownEventTypes: number;
  duplicateOrders: number;
};

export type Dataset = {
  orders: ProcessedOrder[];
  quality: DataQuality;
  asOf: Date;
  products: string[];
  countries: string[];
};

export type Filters = {
  from: string;
  to: string;
  product: string;
  country: string;
  includeTest: boolean;
  includeInactive: boolean;
};

export type StuckRow = {
  order: ProcessedOrder;
  kit: ProcessedKit | null;
  stage: StageKey;
  enteredAt: Date;
  daysInStage: number;
  targetDays: number;
  overdueBy: number;
};
