import type { KalenderWoche } from '@/types';

// Returns ISO date string for the Monday of the week containing `date`
export function getMontag(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getKW(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getMonatName(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long' });
}

// Generate array of KalenderWoche for a date range
export function generiereKalenderwochen(
  von: Date,
  bis: Date
): KalenderWoche[] {
  const wochen: KalenderWoche[] = [];
  const start = getMontag(von);
  const end = getMontag(bis);

  const current = new Date(start);
  while (current <= end) {
    wochen.push({
      wocheStart: toISODate(current),
      kw: getKW(current),
      monat: getMonatName(current),
      jahr: current.getFullYear(),
    });
    current.setDate(current.getDate() + 7);
  }
  return wochen;
}

// Group KalenderWochen by month label (for board headers)
export function gruppiereNachMonat(
  wochen: KalenderWoche[]
): { monat: string; wochen: KalenderWoche[] }[] {
  const groups: { monat: string; wochen: KalenderWoche[] }[] = [];
  for (const w of wochen) {
    const label = `${w.monat} ${w.jahr}`;
    const last = groups[groups.length - 1];
    if (last && last.monat === label) {
      last.wochen.push(w);
    } else {
      groups.push({ monat: label, wochen: [w] });
    }
  }
  return groups;
}

export function formatDatum(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
