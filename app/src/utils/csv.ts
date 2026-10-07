import type { Measurement } from '../types';

export const CSV_COLUMNS: (keyof Measurement)[] = [
  'id',
  'sessionId',
  'timestamp',
  'latitude',
  'longitude',
  'accuracy',
  'connectionType',
  'generation',
  'networkSubtype',
  'operator',
  'signalDbm',
  'signalLevel',
  'wifiStrength',
  'rttMin',
  'rttAvg',
  'rttMax',
  'jitter',
  'lossPct',
  'downloadMbps',
  'uploadMbps',
  'quality',
  'source',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Measurement[]): string {
  const header = [...CSV_COLUMNS, 'datetime'].join(',');
  const lines = rows.map(m =>
    [...CSV_COLUMNS.map(c => csvCell(m[c])), new Date(m.timestamp).toISOString()].join(','),
  );
  return [header, ...lines].join('\n');
}

export function toJson(rows: Measurement[]): string {
  return JSON.stringify(rows, null, 2);
}
