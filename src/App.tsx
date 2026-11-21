import { useEffect, useMemo, useState } from 'react';
import { DataQualityPanel } from './components/DataQualityPanel';
import { DurationPanel } from './components/DurationPanel';
import { FilterBar } from './components/FilterBar';
import { KpiGrid } from './components/KpiGrid';
import { LoadBar } from './components/LoadBar';
import { OrderPanel } from './components/OrderPanel';
import { PipelineStrip } from './components/PipelineStrip';
import { StuckPanel } from './components/StuckPanel';
import { TrendPanel } from './components/TrendPanel';
import { checkUploads, parseCsvText } from './lib/csv';
import { SAMPLE_AS_OF, toIsoDate } from './lib/dates';
import { fmtInt } from './lib/format';
import {
  applyFilters,
  durationStats,
  EMPTY_FILTERS,
  overview,
  pipelineCounts,
  stuckKits,
  weeklyTrends,
} from './lib/metrics';
import { buildDataset } from './lib/process';
import type { Dataset, Filters, RawRow } from './lib/types';

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [asOf, setAsOf] = useState(toIsoDate(SAMPLE_AS_OF));
  const [sourceLabel, setSourceLabel] = useState('Sample CSVs are bundled with the app.');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [held, setHeld] = useState<{ orders?: RawRow[]; events?: RawRow[] }>({});

  useEffect(() => {
    void loadSample();
  }, []);

  const asOfDate = useMemo(() => new Date(`${asOf}T00:00:00Z`), [asOf]);

  const filtered = useMemo(
    () => (dataset ? applyFilters(dataset.orders, filters) : []),
    [dataset, filters],
  );
  const stuck = useMemo(() => stuckKits(filtered, asOfDate), [filtered, asOfDate]);
  const stats = useMemo(
    () => (dataset ? overview(dataset.orders, filtered, stuck) : null),
    [dataset, filtered, stuck],
  );
  const pipeline = useMemo(() => pipelineCounts(filtered), [filtered]);
  const hops = useMemo(() => durationStats(filtered), [filtered]);
  const trends = useMemo(() => weeklyTrends(filtered), [filtered]);
  const selected = useMemo(() => {
    if (!dataset || !selectedId) return null;
    return dataset.orders.find((o) => o.order.order_id === selectedId) ?? null;
  }, [dataset, selectedId]);

  async function loadSample() {
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const [ordersText, eventsText] = await Promise.all([
        fetch('./orders.csv').then((r) => {
          if (!r.ok) throw new Error('Could not fetch orders.csv');
          return r.text();
        }),
        fetch('./kit_events.csv').then((r) => {
          if (!r.ok) throw new Error('Could not fetch kit_events.csv');
          return r.text();
        }),
      ]);
      applyPair(parseCsvText(ordersText).rows, parseCsvText(eventsText).rows, 'Bundled sample data');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample CSVs');
    } finally {
      setLoading(false);
    }
  }

  function applyPair(orderRows: RawRow[], eventRows: RawRow[], label: string) {
    const next = buildDataset(orderRows, eventRows);
    setDataset(next);
    setHeld({});
    setAsOf(toIsoDate(next.asOf));
    setSourceLabel(
      `${label}: ${fmtInt(next.orders.length)} orders, ${fmtInt(next.quality.eventRows)} event rows.`,
    );
    setSelectedId(null);
  }

  async function onFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setWarnings([]);
    const parsed = await Promise.all(
      files.map(async (file) => ({ name: file.name, ...parseCsvText(await file.text()) })),
    );
    const check = checkUploads(parsed);
    if (check.errors.length) {
      setError(check.errors.join(' '));
      return;
    }
    setWarnings(check.warnings);
    const nextHeld = { ...held };
    if (check.orders) nextHeld.orders = check.orders;
    if (check.events) nextHeld.events = check.events;
    setHeld(nextHeld);
    if (nextHeld.orders && nextHeld.events) {
      applyPair(nextHeld.orders, nextHeld.events, 'Uploaded CSVs');
      return;
    }
    setSourceLabel(
      nextHeld.orders
        ? 'Orders file loaded. Add the kit events CSV to rebuild.'
        : 'Events file loaded. Add the orders CSV to rebuild.',
    );
  }

  function selectOrder(orderId: string) {
    setSelectedId(orderId);
    document.getElementById('order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Nebula Ops</p>
          <h1>Kit lifecycle</h1>
          <p className="lede">
            Volume, stage times, and kits that have sat past their target. Built for a snapshot export —
            change the date if you load a different file pair.
          </p>
        </div>
      </header>

      <LoadBar
        loading={loading}
        sourceLabel={sourceLabel}
        asOf={asOf}
        onAsOf={setAsOf}
        onSample={() => void loadSample()}
        onFiles={(files) => void onFiles(files)}
      />

      {error ? <p className="error">{error}</p> : null}
      {warnings.length ? (
        <ul className="warn-list">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {dataset && stats ? (
        <>
          <FilterBar
            filters={filters}
            products={dataset.products}
            countries={dataset.countries}
            onChange={setFilters}
          />
          <KpiGrid stats={stats} />
          <PipelineStrip counts={pipeline} />
          <div className="split section">
            <DurationPanel hops={hops} />
            <StuckPanel rows={stuck} asOf={asOf} selectedId={selectedId} onSelect={selectOrder} />
          </div>
          <TrendPanel weeks={trends} />
          <OrderPanel orders={dataset.orders} selected={selected} onSelect={selectOrder} />
          <DataQualityPanel quality={dataset.quality} />
        </>
      ) : (
        <p className="empty section">Load the sample files or drop your own CSVs to open the dashboard.</p>
      )}
    </div>
  );
}
