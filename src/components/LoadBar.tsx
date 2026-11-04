import { useState, type DragEvent } from 'react';

type Props = {
  loading: boolean;
  sourceLabel: string;
  asOf: string;
  onAsOf: (value: string) => void;
  onSample: () => void;
  onFiles: (files: File[]) => void;
};

export function LoadBar({ loading, sourceLabel, asOf, onAsOf, onSample, onFiles }: Props) {
  const [active, setActive] = useState(false);

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setActive(false);
    onFiles([...event.dataTransfer.files]);
  };

  return (
    <div className="card pad">
      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className="btn primary" onClick={onSample} disabled={loading}>
          Load sample data
        </button>
        <label className="btn file-btn">
          Choose CSVs
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(e) => {
              onFiles([...e.target.files ?? []]);
              e.target.value = '';
            }}
          />
        </label>
        <label className="field">
          Snapshot date
          <input type="date" value={asOf} onChange={(e) => onAsOf(e.target.value)} />
        </label>
        <div className="grow note">{loading ? 'Loading…' : sourceLabel}</div>
      </div>
      <div
        className={`drop${active ? ' active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={drop}
      >
        Drop a pair of CSVs here. Files are detected by columns, not by filename, so a hidden test
        set with the same headers will work.
      </div>
    </div>
  );
}
