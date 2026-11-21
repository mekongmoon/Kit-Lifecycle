import { fmtInt } from '../lib/format';
import type { DataQuality } from '../lib/types';

type Props = {
  quality: DataQuality;
};

export function DataQualityPanel({ quality }: Props) {
  const { issues, issueCount } = quality;
  const dropped = issues.filter((i) => i.severity === 'dropped').length;

  return (
    <div className="quality">
      <p>
        Data cleanup on load: dropped {fmtInt(quality.duplicateEvents)} duplicate events,{' '}
        {fmtInt(quality.orphanEvents)} events with no matching order,{' '}
        {fmtInt(quality.eventsSkipped)} unreadable event rows, {fmtInt(quality.ordersSkipped)} unreadable
        orders, and {fmtInt(quality.duplicateOrders)} duplicate orders.
        {quality.unknownEventTypes
          ? ` Kept ${fmtInt(quality.unknownEventTypes)} unknown event types on the timeline.`
          : ''}{' '}
        Test orders are hidden unless you tick the filter. Upload-only orders are counted but have no kit
        pipeline. QC-failed kits use a 7-day replacement clock, which is not in the brief.
      </p>
      {issueCount > 0 ? (
        <details className="issues">
          <summary>
            {fmtInt(issueCount)} row {issueCount === 1 ? 'issue' : 'issues'}
            {issueCount > issues.length ? ` (showing first ${fmtInt(issues.length)})` : ''}
            {dropped ? ` · ${fmtInt(dropped)} listed rows dropped` : ''}
          </summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Line</th>
                  <th>ID</th>
                  <th>Problem</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, i) => (
                  <tr key={`${issue.file}-${issue.line}-${i}`}>
                    <td>{issue.file}</td>
                    <td className="mono">{issue.line}</td>
                    <td className="mono">{issue.id || '—'}</td>
                    <td>{issue.reason}</td>
                    <td>
                      <span className={`badge ${issue.severity === 'dropped' ? 'bad' : 'neutral'}`}>
                        {issue.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
