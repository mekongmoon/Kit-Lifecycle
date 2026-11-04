import { STAGE_LABEL } from '../lib/pipeline';
import type { StageKey } from '../lib/types';

type Props = {
  counts: { stage: StageKey; count: number }[];
};

export function PipelineStrip({ counts }: Props) {
  const total = counts.reduce((s, c) => s + c.count, 0) || 1;
  return (
    <div className="card pad section">
      <h2>Where kits are now</h2>
      <div className="pipeline">
        {counts.map(({ stage, count }) => {
          const cls =
            stage === 'complete' ? ' complete' : stage === 'qc_failed' || stage === 'awaiting_sample' ? ' stuckish' : '';
          return (
            <div className={`pipe${cls}`} key={stage}>
              <strong>{count}</strong>
              <em>{STAGE_LABEL[stage]}</em>
              <em>{Math.round((count / total) * 100)}%</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}
