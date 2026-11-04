import { productLabel } from '../lib/pipeline';
import type { Filters } from '../lib/types';

type Props = {
  filters: Filters;
  products: string[];
  countries: string[];
  onChange: (next: Filters) => void;
};

export function FilterBar({ filters, products, countries, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="card pad section">
      <h2>Filters</h2>
      <div className="row">
        <label className="field">
          Order created from
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="field">
          to
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <label className="field">
          Product
          <select value={filters.product} onChange={(e) => set({ product: e.target.value })}>
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={p} value={p}>{productLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Country
          <select value={filters.country} onChange={(e) => set({ country: e.target.value })}>
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.includeTest}
            onChange={(e) => set({ includeTest: e.target.checked })}
          />
          Include test orders
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.includeInactive}
            onChange={(e) => set({ includeInactive: e.target.checked })}
          />
          Include cancelled / refunded
        </label>
      </div>
    </div>
  );
}
