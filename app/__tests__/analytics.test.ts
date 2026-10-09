import { computeAnalytics, networkLabel } from '../src/engine/analytics';
import type { Measurement } from '../src/types';

const base: Measurement = {
  id: 1, sessionId: 1, timestamp: 0, latitude: -32.48, longitude: -58.23, accuracy: 10,
  connectionType: 'wifi', generation: null, networkSubtype: 'Casa', operator: null,
  signalDbm: null, signalLevel: null, wifiStrength: 80, rttMin: 10, rttAvg: 20, rttMax: 30,
  jitter: 5, lossPct: 0, downloadMbps: 100, uploadMbps: 50, quality: 95, source: 'manual', pings: [],
};

const rows: Measurement[] = [
  base,
  { ...base, id: 2, downloadMbps: null, uploadMbps: null, quality: 85 },
  { ...base, id: 3, connectionType: 'cellular', generation: '4G', operator: 'Personal', rttAvg: 60, quality: 40, downloadMbps: 20, uploadMbps: 5 },
  { ...base, id: 4, connectionType: 'none', rttAvg: null, jitter: null, lossPct: 100, quality: 0, latitude: null, longitude: null, source: 'background', downloadMbps: null, uploadMbps: null },
];

describe('networkLabel', () => {
  it('usa la generación celular o el tipo de conexión', () => {
    expect(networkLabel({ connectionType: 'cellular', generation: '5G' })).toBe('5G');
    expect(networkLabel({ connectionType: 'wifi', generation: null })).toBe('WiFi');
    expect(networkLabel({ connectionType: 'none', generation: null })).toBe('Sin conexión');
  });
});

describe('computeAnalytics', () => {
  const a = computeAnalytics(rows);

  it('agrupa por tipo de red ordenando por cantidad', () => {
    expect(a.byNetwork.map(g => [g.key, g.count])).toEqual([
      ['WiFi', 2],
      ['4G', 1],
      ['Sin conexión', 1],
    ]);
  });

  it('promedia ignorando nulos', () => {
    const wifi = a.byNetwork[0];
    expect(wifi.quality).toBe(90);
    expect(wifi.downloadMbps).toBe(100); // la medición sin test no cuenta como 0
    expect(a.overall.rttAvg).toBe(33.3); // (20 + 20 + 60) / 3
  });

  it('cuenta la distribución de calidad', () => {
    const counts = Object.fromEntries(a.distribution.map(b => [b.label, b.count]));
    expect(counts).toEqual({ Excelente: 2, Buena: 0, Regular: 1, Mala: 0, 'Sin conexión': 1 });
  });

  it('identifica mejor y peor medición, GPS y background', () => {
    expect(a.best?.id).toBe(1);
    expect(a.worst?.id).toBe(4);
    expect(a.withGps).toBe(3);
    expect(a.background).toBe(1);
    expect(a.byOperator.map(g => g.key)).toEqual(['Personal']);
  });

  it('funciona sin datos', () => {
    const empty = computeAnalytics([]);
    expect(empty.overall.count).toBe(0);
    expect(empty.best).toBeNull();
    expect(empty.overall.rttAvg).toBeNull();
  });
});
