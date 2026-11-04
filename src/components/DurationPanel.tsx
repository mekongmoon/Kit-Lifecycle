import { fmtDays } from '../lib/format';
import { productLabel } from '../lib/pipeline';
import type { HopStats } from '../lib/metrics';

export function DurationPanel({ hops }: { hops: HopStats[] }) {
  return (
    <div className="card pad">
      <h2>Stage duration vs target</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Median and 90th percentile of completed hops only. Missing scans are skipped rather than
        guessed. Fill is median; the pale bar is the target.
      </p>
      {hops.map((hop) => {
        const median = hop.p50 ?? 0;
        const scale = Math.max(hop.targetDays, hop.p90 ?? 0, median, 1);
        const over = hop.p50 !== null && hop.p50 > hop.targetDays;
        return (
          <div className="hop" key={hop.key}>
            <div>
              <div>{hop.label}</div>
              <div className="products">
                {hop.byProduct.map((p) => (
                  <span className="chip" key={p.product}>
                    {productLabel(p.product)} {p.p50 === null ? '—' : fmtDays(p.p50)}
                  </span>
                ))}
              </div>
            </div>
            <div className="bars" title={`target ${hop.targetDays}d`}>
              <div className="target" style={{ width: `${(hop.targetDays / scale) * 100}%` }} />
              <div
                className={`median${over ? ' over' : ''}`}
                style={{ width: `${(median / scale) * 100}%` }}
              />
            </div>
            <div>{hop.p50 === null ? '—' : `p50 ${fmtDays(hop.p50)}`}</div>
            <div>{hop.p90 === null ? '—' : `p90 ${fmtDays(hop.p90)}`}</div>
            <div className="n">n={hop.n}</div>
          </div>
        );
      })}
    </div>
  );
}
