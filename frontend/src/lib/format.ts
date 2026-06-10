export function formatKES(amount: number | string | undefined | null): string {
  const n = Number(amount ?? 0);
  if (n >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
  return `Ksh ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}
