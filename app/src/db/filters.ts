import type { DatePreset, HistoryFilter } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function dateFrom(preset: DatePreset, nowMs = Date.now()): number | null {
  switch (preset) {
    case 'today': {
      const d = new Date(nowMs);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case '7d':
      return nowMs - 7 * DAY_MS;
    case '30d':
      return nowMs - 30 * DAY_MS;
    default:
      return null;
  }
}

/** Traduce el filtro del historial (RF-09) a una cláusula WHERE con parámetros. */
export function buildWhere(
  filter: HistoryFilter,
  nowMs = Date.now(),
): { where: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.network === 'wifi' || filter.network === 'cellular') {
    clauses.push('connection_type = ?');
    params.push(filter.network);
  } else if (filter.network !== 'all') {
    clauses.push('generation = ?');
    params.push(filter.network);
  }

  const from = dateFrom(filter.date, nowMs);
  if (from !== null) {
    clauses.push('timestamp >= ?');
    params.push(from);
  }

  if (filter.bbox) {
    clauses.push('latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
    params.push(filter.bbox.minLat, filter.bbox.maxLat, filter.bbox.minLon, filter.bbox.maxLon);
  }

  if (filter.sessionId !== null) {
    clauses.push('session_id = ?');
    params.push(filter.sessionId);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}
