# Kit Lifecycle Dashboard

A dashboard for tracking DNA testing kits from shipping to final reports. It helps operations teams monitor progress and find kits that need follow-up.

- **Live App:** https://kit-lifecycle-ops-dashboard.vercel.app/
- **GitHub:** https://github.com/mightstar/kit-lifecycle

## Tech Stack

React, TypeScript, Vite, PapaParse, and Vitest.

## Features

- Track kit statuses, turnaround times (median and 90th percentile), and overdue kits.
- Search orders and view kit histories, including replacements.
- Filter by date, product, or country, and upload CSV data.

## Data Handling

- Remove duplicate events and ignore events linked to unknown orders.
- Keep tracking kits with missing scans; calculate stage durations only when both timestamps exist.
- Link replacement kits to their original orders without losing individual histories.
- Exclude upload-only orders from physical-kit metrics. Test, canceled, and refunded orders are excluded by default but can be included with filters.
- Measure turnaround in calendar days and flag overdue kits using the assignment's stage targets, plus a 7-day follow-up threshold after QC failure.
- Treat timestamps without timezone information as UTC.

## Next Steps

Improve CSV validation, error messages, and tests for incomplete or unusual event data.

## Run Locally

```bash
npm install
npm run dev
```

Run tests with `npm test` or build with `npm run build`. You can use the sample data or upload compatible CSV files.
