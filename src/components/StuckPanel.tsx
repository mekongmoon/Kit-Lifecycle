import { useMemo, useState } from 'react';
import { sortStuck, stuckByStage, stuckToCsv, type StuckSort } from '../lib/export';
import { fmtDate, fmtDays } from '../lib/format';
import { productLabel, STAGE_LABEL } from '../lib/pipeline';
import type { StageKey, StuckRow } from '../lib/types';

type Props = {
  rows: StuckRow[];
  asOf: string;
  selectedId: string | null;
  onSelect: (orderId: string) => void;
};

const VISIBLE = 80;

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StuckPanel({ rows, asOf, selectedId, onSelect }: Props) {
  const [sortBy, setSortBy] = useState<StuckSort>('overdue');
  const [stage, setStage] = useState<StageKey | 'all'>('all');

  const groups = useMemo(() => stuckByStage(rows), [rows]);
  // If filters change and the chosen stage no longer has stuck kits, fall back to all.
  const activeStage = stage !== 'all' && !groups.some((g) => g.stage === stage) ? 'all' : stage;
  const list = useMemo(() => {
    const inStage = activeStage === 'all' ? rows : rows.filter((r) => r.stage === activeStage);
    return sortStuck(inStage, sortBy);
  }, [rows, activeStage, sortBy]);

  return (
    <div className="card pad">
      <h2>Needs follow-up</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Paid kit orders whose current stage has run past its target. Click a row to open the order.
      </p>
      {rows.length === 0 ? (
        <p className="empty">Nothing is overdue in this view.</p>
      ) : (
        <>
          <div className="products" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={`chip toggle${activeStage === 'all' ? ' on' : ''}`}
              onClick={() => setStage('all')}
            >
              All · {rows.length}
            </button>
            {groups.map((g) => (
              <button
                key={g.stage}
                type="button"
                className={`chip toggle${activeStage === g.stage ? ' on' : ''}`}
                onClick={() => setStage(g.stage)}
              >
                {STAGE_LABEL[g.stage]} · {g.count}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="field">
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as StuckSort)}>
                <option value="overdue">Most overdue</option>
                <option value="days">Longest in stage</option>
                <option value="stage">Pipeline stage</option>
                <option value="country">Country</option>
              </select>
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => download(`stuck-kits-${asOf}.csv`, stuckToCsv(list))}
            >
              Export {list.length} to CSV
            </button>
          </div>
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
                {list.slice(0, VISIBLE).map((row) => {
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
        </>
      )}
      {list.length > VISIBLE ? (
        <p className="note">
          Showing the first {VISIBLE} of {list.length}. The CSV export includes all of them.
        </p>
      ) : null}
    </div>
  );
}
