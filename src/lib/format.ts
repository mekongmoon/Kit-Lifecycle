export function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function fmtDays(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1) {
    const hours = Math.round(n * 24);
    return `${hours}h`;
  }
  return `${n.toFixed(1)}d`;
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(d: Date): string {
  return `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

export function statusLabel(status: string): string {
  if (!status) return 'unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
