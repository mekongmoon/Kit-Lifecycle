# Planning

Working plan for the Kit Lifecycle Dashboard. The README covers the final decisions; this file tracks scope, status, and what comes next.

## Goal

Give the ops team one page that answers:

1. How is the pipeline doing overall (volume, current stage, completed)?
2. How long does each stage take, and how does that differ by product?
3. Which kits are stuck and need follow-up?
4. What happened to a specific order?

It also needs filters (date, product, country) and must accept a different pair of CSVs with the same columns.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| Parsing | `src/lib/csv.ts` | PapaParse wrapper, BOM/whitespace cleanup, detects orders vs. events file |
| Normalization | `src/lib/process.ts`, `src/lib/dates.ts` | Typed rows, dedupe, timestamp parsing (no TZ → UTC), kit/replacement linking, data-quality counts |
| Domain rules | `src/lib/pipeline.ts` | Event order, stage mapping, hop definitions, stuck targets |
| Metrics | `src/lib/metrics.ts` | Filters, pipeline counts, p50/p90 durations, stuck list, overview, search |
| UI | `src/components/*` | Load bar, filters, KPIs, pipeline strip, durations, stuck list, order drill-down |

Everything runs in the browser, so there is no backend and the app deploys as a static Vite build.

## Status

### Done

- [x] CSV upload with auto-detection, plus bundled sample data
- [x] Dedupe events and drop events for unknown orders
- [x] Kits with missing scans stay tracked; durations only when both endpoints exist
- [x] Replacement kits linked to the original order with separate histories
- [x] Upload-only orders excluded from physical-kit metrics
- [x] Test / cancelled / refunded excluded by default, with a filter toggle
- [x] Stage durations (median, p90) overall and by product
- [x] Stuck-kit list using the stage targets, plus a 7-day QC-failure follow-up rule
- [x] Order search and per-order timeline
- [x] Unit and integration tests (Vitest) for parsing, dates, and processing
- [x] Deployed to Vercel
- [x] Header validation on upload: missing required columns are named, two files of the same kind are rejected, empty and header-only files are flagged
- [x] Row-level data-quality panel listing dropped and kept-with-fallback rows by CSV line (capped at 200)
- [x] Edge-case tests: out-of-order scans, negative durations, QC retests, events after `report_ready` / `kit_replaced`, date-only timestamps, empty inputs, case and whitespace variants
- [x] Fixes found by those tests: a reported kit stays complete if `kit_replaced` follows it; a finished order shows its completed kit; `event_type` and `product` are case-insensitive
- [x] Stuck list: stage chips, sort options, and CSV export of the full list
- [x] Weekly trend of kit orders with reports delivered and median order-to-report time
- [x] Fixed a JSX typo in `OrderPanel` that broke `tsc` and the production build

### Next

1. **Performance**: move parsing to a Web Worker if real exports are much larger than the 5,000-order sample
2. **Trend breakdowns**: split the weekly chart by product or country (small multiples, not stacked)
3. **Configurable targets**: let ops edit the per-stage targets and the QC-failure clock instead of hard-coding them in `src/lib/pipeline.ts`
4. **Shareable views**: keep filters and the selected order in the URL
5. **Visual check**: the new panels were checked with tests and a production build, not in a browser; a quick pass on desktop and mobile widths is still needed

## Open questions

- Should the "as of" date be the export date (inferred from the latest timestamp) or today? The app currently infers it from the latest timestamp on upload and lets the user change it.
- Is calendar-day turnaround right, or does ops want business days for lab stages?
- Should a replaced kit's time count against the order's total turnaround?
