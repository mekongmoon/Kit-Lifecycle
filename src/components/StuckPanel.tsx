import { fmtDate, fmtDays } from '../lib/format';
import { productLabel, STAGE_LABEL } from '../lib/pipeline';
import type { StuckRow } from '../lib/types';

type Props = {
  rows: StuckRow[];
  selectedId: string | null;
  onSelect: (orderId: string) => void;
};

export function StuckPanel({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="card pad">
      <h2>Needs follow-up</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Paid kit orders whose current stage has run past its target. Click a row to open the order.
      </p>
      {rows.length === 0 ? (
        <p className="empty">Nothing is overdue in this view.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Kit</th>
                <th>Stage</th>
                <th>Days in stage</th>
                <th>Overdue</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((row) => {
                const id = row.order.order.order_id;
                return (
                  <tr
                    key={`${id}-${row.kit?.kit_id ?? 'none'}`}
                    className={`clickable${selectedId === id ? ' selected' : ''}`}
                    onClick={() => onSelect(id)}
                  >
                    <td className="mono">{id}</td>
                    <td className="mono">{row.kit?.kit_id ?? '—'}</td>
                    <td>{STAGE_LABEL[row.stage]}</td>
                    <td>
                      {fmtDays(row.daysInStage)}
                      <div className="note">since {fmtDate(row.enteredAt)}</div>
                    </td>
                    <td>
                      <span className="badge bad">{fmtDays(row.overdueBy)}</span>
                    </td>
                    <td>
                      {productLabel(row.order.order.product)}
                      <div className="note">{row.order.order.country}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 80 ? <p className="note">Showing the 80 most overdue of {rows.length}.</p> : null}
    </div>
  );
}
