import type { Measurement } from '../types';
import { qualityColor, qualityLabel, type QualityLabel } from './stats';

export interface GroupStats {
  key: string;
  count: number;
  quality: number | null;
  rttAvg: number | null;
  jitter: number | null;
  lossPct: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export interface QualityBucket {
  label: QualityLabel;
  color: string;
  count: number;
}

export interface Analytics {
  overall: GroupStats;
  byNetwork: GroupStats[];
  byOperator: GroupStats[];
  distribution: QualityBucket[];
  best: Measurement | null;
  worst: Measurement | null;
  withGps: number;
  background: number;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Promedio ignorando valores nulos (una medición sin throughput no cuenta como 0 Mbps). */
function mean(values: (number | null)[], decimals = 1): number | null {
  const ok = values.filter((v): v is number => v !== null);
  return ok.length ? round(ok.reduce((a, b) => a + b, 0) / ok.length, decimals) : null;
}

/** Etiqueta del tipo de red: generación celular (4G, 5G…) o WiFi / Sin conexión. */
export function networkLabel(m: Pick<Measurement, 'connectionType' | 'generation'>): string {
  if (m.generation) return m.generation;
  switch (m.connectionType) {
    case 'wifi':
      return 'WiFi';
    case 'cellular':
      return 'Celular';
    case 'none':
      return 'Sin conexión';
    case 'ethernet':
      return 'Ethernet';
    default:
      return 'Otra';
  }
}

function groupStats(key: string, rows: Measurement[]): GroupStats {
  return {
    key,
    count: rows.length,
    quality: mean(rows.map(m => m.quality), 0),
    rttAvg: mean(rows.map(m => m.rttAvg)),
    jitter: mean(rows.map(m => m.jitter)),
    lossPct: mean(rows.map(m => m.lossPct)),
    downloadMbps: mean(rows.map(m => m.downloadMbps), 2),
    uploadMbps: mean(rows.map(m => m.uploadMbps), 2),
  };
}

function groupBy(rows: Measurement[], keyOf: (m: Measurement) => string): GroupStats[] {
  const groups = new Map<string, Measurement[]>();
  for (const m of rows) {
    const k = keyOf(m);
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([k, list]) => groupStats(k, list))
    .sort((a, b) => b.count - a.count);
}

const BUCKETS: { label: QualityLabel; sample: number }[] = [
  { label: 'Excelente', sample: 90 },
  { label: 'Buena', sample: 70 },
  { label: 'Regular', sample: 50 },
  { label: 'Mala', sample: 10 },
  { label: 'Sin conexión', sample: 0 },
];

/** Estadísticas agregadas del historial filtrado (pestaña Analítica). */
export function computeAnalytics(rows: Measurement[]): Analytics {
  const distribution = BUCKETS.map(b => ({
    label: b.label,
    color: b.label === 'Sin conexión' ? '#6b7280' : qualityColor(b.sample),
    count: rows.filter(m => qualityLabel(m.quality, m.rttAvg !== null) === b.label).length,
  }));

  let best: Measurement | null = null;
  let worst: Measurement | null = null;
  for (const m of rows) {
    if (!best || m.quality > best.quality) best = m;
    if (!worst || m.quality < worst.quality) worst = m;
  }

  return {
    overall: groupStats('Total', rows),
    byNetwork: groupBy(rows, networkLabel),
    byOperator: groupBy(
      rows.filter(m => m.operator),
      m => m.operator!,
    ),
    distribution,
    best,
    worst,
    withGps: rows.filter(m => m.latitude !== null).length,
    background: rows.filter(m => m.source === 'background').length,
  };
}
