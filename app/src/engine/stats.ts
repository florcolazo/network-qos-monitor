import type { PingStats, Settings } from '../types';

const round = (n: number, decimals = 1) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Calcula min/avg/max, jitter y pérdida a partir de las muestras de RTT.
 * Una muestra `null` representa una sonda sin respuesta (timeout o error).
 * El jitter es la media de las diferencias absolutas entre RTT consecutivos
 * (variación de retardo entre paquetes, en la línea de RFC 3550).
 */
export function computePingStats(
  host: string,
  port: number,
  samples: (number | null)[],
): PingStats {
  const ok = samples.filter((s): s is number => s !== null);
  const sent = samples.length;
  const received = ok.length;
  const lossPct = sent === 0 ? 100 : round(((sent - received) / sent) * 100);

  if (received === 0) {
    return { host, port, sent, received, lossPct, min: null, avg: null, max: null, jitter: null, samples };
  }

  let jitter = 0;
  for (let i = 1; i < ok.length; i++) {
    jitter += Math.abs(ok[i] - ok[i - 1]);
  }
  jitter = ok.length > 1 ? jitter / (ok.length - 1) : 0;

  return {
    host,
    port,
    sent,
    received,
    lossPct,
    min: round(Math.min(...ok)),
    avg: round(ok.reduce((a, b) => a + b, 0) / received),
    max: round(Math.max(...ok)),
    jitter: round(jitter),
    samples,
  };
}

/** Combina las estadísticas de varios hosts en un único resumen. */
export function aggregatePings(pings: PingStats[]) {
  const withData = pings.filter(p => p.avg !== null);
  const sent = pings.reduce((a, p) => a + p.sent, 0);
  const received = pings.reduce((a, p) => a + p.received, 0);
  const lossPct = sent === 0 ? 100 : round(((sent - received) / sent) * 100);

  if (withData.length === 0) {
    return { rttMin: null, rttAvg: null, rttMax: null, jitter: null, lossPct };
  }
  const mean = (vals: number[]) => round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return {
    rttMin: Math.min(...withData.map(p => p.min!)),
    rttAvg: mean(withData.map(p => p.avg!)),
    rttMax: Math.max(...withData.map(p => p.max!)),
    jitter: mean(withData.map(p => p.jitter!)),
    lossPct,
  };
}

/**
 * Puntaje de calidad 0..100 (100 = excelente). Se usa como intensidad del heatmap.
 *  - Latencia: 100 pts hasta 30 ms, 0 pts desde 500 ms.
 *  - Jitter:   100 pts hasta 5 ms, 0 pts desde 100 ms.
 *  - Pérdida:  100 pts con 0 %, 0 pts desde 20 %.
 *  - Si hay test de descarga: 100 pts desde 50 Mbps.
 */
export function qualityScore(input: {
  rttAvg: number | null;
  jitter: number | null;
  lossPct: number;
  downloadMbps?: number | null;
}): number {
  if (input.rttAvg === null) {
    return 0;
  }
  const linear = (v: number, good: number, bad: number) =>
    clamp(((bad - v) / (bad - good)) * 100, 0, 100);

  const latency = linear(input.rttAvg, 30, 500);
  const jitter = linear(input.jitter ?? 0, 5, 100);
  const loss = linear(input.lossPct, 0, 20);
  let score = latency * 0.5 + jitter * 0.2 + loss * 0.3;

  if (input.downloadMbps != null) {
    const thr = clamp((input.downloadMbps / 50) * 100, 0, 100);
    score = score * 0.7 + thr * 0.3;
  }
  return Math.round(score);
}

export type QualityLabel = 'Excelente' | 'Buena' | 'Regular' | 'Mala' | 'Sin conexión';

export function qualityLabel(score: number, hasData = true): QualityLabel {
  if (!hasData) return 'Sin conexión';
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Buena';
  if (score >= 35) return 'Regular';
  return 'Mala';
}

export function qualityColor(score: number): string {
  if (score >= 80) return '#1a9850';
  if (score >= 60) return '#91cf60';
  if (score >= 35) return '#fdae61';
  return '#d73027';
}

/** Devuelve el motivo de degradación severa, o null si la red está dentro de umbrales. */
export function degradationReason(
  m: { rttAvg: number | null; lossPct: number; connectionType: string },
  settings: Pick<Settings, 'notifyRttMs' | 'notifyLossPct'>,
): string | null {
  if (m.connectionType === 'none') return 'Sin conexión de datos';
  if (m.rttAvg === null) return 'Ningún host respondió';
  if (m.lossPct >= settings.notifyLossPct) return `Pérdida de paquetes ${m.lossPct}%`;
  if (m.rttAvg >= settings.notifyRttMs) return `Latencia alta (${m.rttAvg} ms)`;
  return null;
}

/** Mbps a partir de bytes y milisegundos. */
export function toMbps(bytes: number, ms: number): number | null {
  if (ms <= 0 || bytes <= 0) return null;
  return round((bytes * 8) / (ms / 1000) / 1e6, 2);
}
