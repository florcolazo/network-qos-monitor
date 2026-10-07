import {
  aggregatePings,
  computePingStats,
  degradationReason,
  qualityScore,
  toMbps,
} from '../src/engine/stats';

describe('computePingStats', () => {
  it('calcula min/avg/max, jitter y pérdida', () => {
    const s = computePingStats('h', 443, [10, 20, null, 30, 20]);
    expect(s.sent).toBe(5);
    expect(s.received).toBe(4);
    expect(s.lossPct).toBe(20);
    expect(s.min).toBe(10);
    expect(s.max).toBe(30);
    expect(s.avg).toBe(20);
    // |20-10| + |30-20| + |20-30| = 30 / 3 diferencias
    expect(s.jitter).toBe(10);
  });

  it('marca 100% de pérdida cuando no responde ninguna sonda', () => {
    const s = computePingStats('h', 443, [null, null]);
    expect(s.lossPct).toBe(100);
    expect(s.avg).toBeNull();
    expect(s.jitter).toBeNull();
  });

  it('jitter 0 con una sola muestra', () => {
    expect(computePingStats('h', 1, [15]).jitter).toBe(0);
  });
});

describe('aggregatePings', () => {
  it('combina varios hosts ignorando los que no respondieron', () => {
    const a = computePingStats('a', 1, [10, 20]);
    const b = computePingStats('b', 1, [30, 50]);
    const c = computePingStats('c', 1, [null, null]);
    const agg = aggregatePings([a, b, c]);
    expect(agg.rttMin).toBe(10);
    expect(agg.rttMax).toBe(50);
    expect(agg.rttAvg).toBe(27.5);
    expect(agg.lossPct).toBe(33.3);
  });
});

describe('qualityScore', () => {
  it('100 para una red excelente', () => {
    expect(qualityScore({ rttAvg: 20, jitter: 2, lossPct: 0 })).toBe(100);
  });
  it('0 sin respuesta', () => {
    expect(qualityScore({ rttAvg: null, jitter: null, lossPct: 100 })).toBe(0);
  });
  it('baja con latencia y pérdida altas', () => {
    expect(qualityScore({ rttAvg: 400, jitter: 80, lossPct: 15 })).toBeLessThan(30);
  });
  it('considera el throughput cuando está disponible', () => {
    const base = { rttAvg: 20, jitter: 2, lossPct: 0 };
    expect(qualityScore({ ...base, downloadMbps: 5 })).toBeLessThan(qualityScore(base));
  });
});

describe('degradationReason', () => {
  const thresholds = { notifyRttMs: 300, notifyLossPct: 20 };
  it('null con red normal', () => {
    expect(degradationReason({ rttAvg: 50, lossPct: 0, connectionType: 'wifi' }, thresholds)).toBeNull();
  });
  it('detecta pérdida, latencia y falta de conexión', () => {
    expect(degradationReason({ rttAvg: 50, lossPct: 25, connectionType: 'wifi' }, thresholds)).toMatch(/Pérdida/);
    expect(degradationReason({ rttAvg: 500, lossPct: 0, connectionType: 'cellular' }, thresholds)).toMatch(/Latencia/);
    expect(degradationReason({ rttAvg: null, lossPct: 100, connectionType: 'none' }, thresholds)).toMatch(/Sin conexión/);
  });
});

describe('toMbps', () => {
  it('convierte bytes y ms a Mbps', () => {
    // 10 MB (decimal) en 1 s = 80 Mbps
    expect(toMbps(10_000_000, 1000)).toBe(80);
  });
  it('null si el tiempo es 0', () => {
    expect(toMbps(100, 0)).toBeNull();
  });
});
