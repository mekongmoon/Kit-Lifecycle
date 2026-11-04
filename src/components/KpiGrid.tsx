import { fmtInt } from '../lib/format';
import type { Overview } from '../lib/metrics';

export function KpiGrid({ stats }: { stats: Overview }) {
  return (
    <div className="kpis section">
      <div className="card kpi">
        <b>{fmtInt(stats.orders)}</b>
        <span>Orders in view</span>
      </div>
      <div className="card kpi">
        <b>{fmtInt(stats.kitOrders)}</b>
        <span>Kit orders</span>
      </div>
      <div className="card kpi">
        <b>{fmtInt(stats.inFlight)}</b>
        <span>In the pipeline</span>
      </div>
      <div className="card kpi good">
        <b>{fmtInt(stats.finished)}</b>
        <span>Reports ready</span>
      </div>
      <div className="card kpi alert">
        <b>{fmtInt(stats.stuck)}</b>
        <span>Need follow-up</span>
      </div>
      <div className="card kpi">
        <b>{fmtInt(stats.replacements)}</b>
        <span>Kits replaced</span>
      </div>
    </div>
  );
}
