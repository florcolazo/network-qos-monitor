import { buildWhere, dateFrom } from '../src/db/filters';
import type { HistoryFilter } from '../src/types';

const base: HistoryFilter = { network: 'all', date: 'all', bbox: null, sessionId: null };
const NOW = new Date(2026, 9, 7, 15, 30).getTime();

describe('buildWhere', () => {
  it('sin filtros no genera WHERE', () => {
    expect(buildWhere(base, NOW)).toEqual({ where: '', params: [] });
  });

  it('filtra por tipo de conexión o por generación', () => {
    expect(buildWhere({ ...base, network: 'wifi' }, NOW).params).toEqual(['wifi']);
    const g = buildWhere({ ...base, network: '4G' }, NOW);
    expect(g.where).toContain('generation = ?');
    expect(g.params).toEqual(['4G']);
  });

  it('combina fecha, zona y sesión', () => {
    const r = buildWhere(
      {
        network: 'cellular',
        date: '7d',
        bbox: { minLat: -33, maxLat: -32, minLon: -59, maxLon: -58 },
        sessionId: 4,
      },
      NOW,
    );
    expect(r.where).toBe(
      'WHERE connection_type = ? AND timestamp >= ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? AND session_id = ?',
    );
    expect(r.params).toEqual(['cellular', NOW - 7 * 86_400_000, -33, -32, -59, -58, 4]);
  });
});

describe('dateFrom', () => {
  it('"hoy" empieza a medianoche', () => {
    expect(dateFrom('today', NOW)).toBe(new Date(2026, 9, 7).getTime());
  });
});
