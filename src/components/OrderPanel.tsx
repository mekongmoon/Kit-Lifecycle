import { useMemo, useState } from 'react';
import { fmtDateTime, statusLabel } from '../lib/format';
import { searchOrders } from '../lib/metrics';
import { productLabel, STAGE_LABEL } from '../lib/pipeline';
import type { OrderKind, ProcessedOrder } from '../lib/types';

type Props = {
  orders: ProcessedOrder[];
  selected: ProcessedOrder | null;
  onSelect: (orderId: string) => void;
};

function eventClass(type: string): string {
  if (type === 'kit_replaced' || type === 'qc_failed') return ' replace';
  if (type === 'report_ready') return ' done';
  return '';
}

function describeStage(stage: OrderKind): string {
  if (stage === 'upload_only') return 'Upload only — no kit is shipped';
  if (stage === 'no_kit') return 'Awaiting first kit event';
  return STAGE_LABEL[stage];
}

export function OrderPanel({ orders, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchOrders(orders, query), [orders, query]);

  return (
    <div className="card pad section" id="order-panel">
      <h2>Order lookup</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Searches the full loaded file, including test and cancelled orders.
      </p>
      <input>
        className="search"
        placeholder="Search order_id, kit_id, or customer_id"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <div className="hits">
          {hits.length === 0 ? (
            <p className="empty">No matches in the loaded files.</p>
          ) : (
            hits.map((item) => (
              <button
                type="button"
                className={`hit${selected?.order.order_id === item.order.order_id ? ' active' : ''}`}
                key={item.order.order_id}
                onClick={() => onSelect(item.order.order_id)}
              >
                <span className="mono">{item.order.order_id}</span>{' '}
                {productLabel(item.order.product)} · {item.order.country} · {statusLabel(item.order.status)}
                <br />
                <small>
                  {item.kits.map((k) => k.kit_id).join(', ') || 'no kit'} · customer {item.order.customer_id}
                </small>
              </button>
            ))
          )}
        </div>
      )}

      {selected ? (
        <OrderDetail order={selected} />
      ) : (
        <p className="empty">Pick a search result or a stuck kit to see the timeline.</p>
      )}
    </div>
  );
}

function OrderDetail({ order }: { order: ProcessedOrder }) {
  return (
    <div>
      <div className="meta-grid">
        <div>
          <b>Order</b>
          <span className="mono">{order.order.order_id}</span>
        </div>
        <div>
          <b>Customer</b>
          <span className="mono">{order.order.customer_id}</span>
        </div>
        <div>
          <b>Created</b>
          {fmtDateTime(order.order.created_at)}
        </div>
        <div>
          <b>Product</b>
          {productLabel(order.order.product)}
        </div>
        <div>
          <b>Country / status</b>
          {order.order.country} · {statusLabel(order.order.status)}
          {order.order.is_test ? ' · test' : ''}
        </div>
        <div>
          <b>Current stage</b>
          {describeStage(order.currentStage)}
        </div>
      </div>

      {order.kits.length === 0 ? (
        <p className="empty">No kit events for this order.</p>
      ) : (
        <div className="timeline">
          {order.kits.map((kit) => (
            <div className="kit-block" key={kit.kit_id}>
              <h3>
                <span className="mono">{kit.kit_id}</span>{' '}
                <span className={`badge ${kit.complete ? 'ok' : kit.replaced ? 'bad' : 'neutral'}`}>
                  {STAGE_LABEL[kit.currentStage]}
                </span>
              </h3>
              {kit.events.map((event) => (
                <div className="event" key={event.event_id}>
                  <span className={`dot${eventClass(event.event_type)}`} />
                  <div>
                    <div>{event.event_type}</div>
                    <div className="note">
                      {event.source || 'unknown source'} · {event.event_id}
                    </div>
                  </div>
                  <div className="when">{fmtDateTime(event.occurred_at)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
