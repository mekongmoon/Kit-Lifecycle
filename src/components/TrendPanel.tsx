import { useState } from 'react';
import { fmtDays, fmtInt } from '../lib/format';
import type { WeekTrend } from '../lib/metrics';

type Props = {
  weeks: WeekTrend[];
};

export function TrendPanel({ weeks }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length === 0) return null;

  const max = Math.max(1, ...weeks.map((w) => w.ordersPlaced));
  const active = hover === null ? null : weeks[hover];

  return (
    <div className="card pad section">
      <h2>Weekly kit orders</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Kit orders placed per week (Monday start, UTC). The latest week may be partial. Hover a bar for
        reports delivered and median order-to-report time that week.
      </p>
      <div className="trend" onMouseLeave={() => setHover(null)}>
        <div className="trend-axis">
          <span>{fmtInt(max)}</span>
          <span>0</span>
        </div>
        <div className="trend-plot" role="img" aria-label="Bar chart of kit orders placed per week">
          {weeks.map((w, i) => (
            <div
              key={w.week}
              className={`trend-col${hover === i ? ' on' : ''}`}
              onMouseEnter={() => setHover(i)}
            >
              <div className="trend-bar" style={{ height: `${(w.ordersPlaced / max) * 100}%` }} />
            </div>
          ))}
          {active && hover !== null ? (
            <div
              className="trend-tip"
              style={{
                left: `${((hover + 0.5) / weeks.length) * 100}%`,
                // Keep the tooltip inside the plot near either edge.
                transform: `translateX(${hover < weeks.length * 0.2 ? '0' : hover > weeks.length * 0.8 ? '-100%' : '-50%'})`,
              }}
            >
              <b>Week of {active.week}</b>
              <div>{fmtInt(active.ordersPlaced)} kit orders placed</div>
              <div>{fmtInt(active.reportsReady)} reports ready</div>
              <div>
                Median order → report:{' '}
                {active.medianDaysToReport === null ? '—' : fmtDays(active.medianDaysToReport)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="trend-labels">
        <span>{weeks[0].week}</span>
        <span>{weeks.at(-1)?.week}</span>
      </div>
      <details className="issues">
        <summary>Show as table</summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Orders placed</th>
                <th>Reports ready</th>
                <th>Median order → report</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td className="mono">{w.week}</td>
                  <td>{fmtInt(w.ordersPlaced)}</td>
                  <td>{fmtInt(w.reportsReady)}</td>
                  <td>{w.medianDaysToReport === null ? '—' : fmtDays(w.medianDaysToReport)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
