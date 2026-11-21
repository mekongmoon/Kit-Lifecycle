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

### Next

Priority order. Each item should be small enough to ship on its own.

1. **CSV validation and error messages**
   - Check for required columns per file and name any that are missing
   - Report per-row problems (bad timestamps, unknown `event_type`, unknown product/status) in a collapsible data-quality panel instead of silently skipping them
   - Warn when both uploads look like the same file type
2. **Edge-case tests**
   - Out-of-order events (e.g. `sample_received` before `kit_delivered`)
   - Events after `report_ready`, or after `kit_replaced` on the old kit
   - Both `qc_passed` and `qc_failed` on one kit
   - Mixed timezone offsets and date-only timestamps
   - Empty files, header-only files, very large files
3. **Stuck-kit workflow**
   - Export the stuck list to CSV
   - Sort and group by stage, days overdue, and country
4. **Trends**
   - Weekly volume and turnaround over time so ops can see if things are getting better or worse
5. **Performance**
   - Move parsing to a Web Worker if real exports are much larger than the sample

## Open questions

- Should the "as of" date be the export date (inferred from the latest timestamp) or today? The app currently infers it from the latest timestamp on upload and lets the user change it.
- Is calendar-day turnaround right, or does ops want business days for lab stages?
- Should a replaced kit's time count against the order's total turnaround?
