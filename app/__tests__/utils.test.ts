import type { Measurement } from '../src/types';
import { toCsv } from '../src/utils/csv';
import { parseTargets } from '../src/utils/targets';

describe('parseTargets', () => {
  it('parsea host:puerto por línea', () => {
    expect(parseTargets('1.1.1.1:443\n  www.google.com:80 \n\n')).toEqual([
      { host: '1.1.1.1', port: 443 },
      { host: 'www.google.com', port: 80 },
    ]);
  });
  it('rechaza líneas inválidas', () => {
    expect(parseTargets('1.1.1.1')).toBeNull();
    expect(parseTargets('host:99999')).toBeNull();
  });
});

describe('toCsv', () => {
  it('genera encabezado y escapa comillas y comas', () => {
    const m = {
      id: 1, sessionId: 1, timestamp: 0, latitude: -32.4, longitude: -58.2, accuracy: 5,
      connectionType: 'cellular', generation: '4G', networkSubtype: 'LTE', operator: 'Op, "SA"',
      signalDbm: -95, signalLevel: 3, wifiStrength: null, rttMin: 10, rttAvg: 20, rttMax: 30,
      jitter: 5, lossPct: 0, downloadMbps: null, uploadMbps: null, quality: 90, source: 'manual', pings: [],
    } as Measurement;
    const [header, row] = toCsv([m]).split('\n');
    expect(header.startsWith('id,sessionId,timestamp')).toBe(true);
    expect(header.endsWith(',datetime')).toBe(true);
    expect(row).toContain('"Op, ""SA"""');
    expect(row.endsWith('1970-01-01T00:00:00.000Z')).toBe(true);
  });
});
