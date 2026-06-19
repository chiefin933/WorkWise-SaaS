export function formatKES(amount: number | string | undefined | null): string {
  const n = Number(amount ?? 0);
  if (n >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
  return `Ksh ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function formatRelativeTime(isoString: string): string {
  const timestamp = new Date(isoString).getTime();
  if (Number.isNaN(timestamp)) return isoString;

  const diffMs = Date.now() - timestamp;
  const absDiffMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absDiffMs < minute) return 'Just now';
  if (absDiffMs < hour) {
    const minutes = Math.max(1, Math.round(absDiffMs / minute));
    return diffMs < 0 ? `In ${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (absDiffMs < day) {
    const hours = Math.round(absDiffMs / hour);
    return diffMs < 0 ? `In ${hours} hour${hours === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (absDiffMs < 2 * day) return diffMs < 0 ? 'Tomorrow' : 'Yesterday';

  const days = Math.round(absDiffMs / day);
  return diffMs < 0 ? `In ${days} days` : `${days} days ago`;
}
