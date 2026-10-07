import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { DEFAULT_SETTINGS } from '../config';
import type { HistoryFilter, Measurement, Session, Settings } from '../types';
import { buildWhere } from './filters';

let db: DB | null = null;

function getDb(): DB {
  if (!db) {
    db = open({ name: 'qos.db' });
    migrate(db);
  }
  return db;
}

function migrate(conn: DB) {
  conn.executeSync(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    label TEXT NOT NULL
  )`);
  conn.executeSync(`CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    timestamp INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    connection_type TEXT NOT NULL,
    generation TEXT,
    network_subtype TEXT,
    operator TEXT,
    signal_dbm INTEGER,
    signal_level INTEGER,
    wifi_strength INTEGER,
    rtt_min REAL,
    rtt_avg REAL,
    rtt_max REAL,
    jitter REAL,
    loss_pct REAL NOT NULL,
    download_mbps REAL,
    upload_mbps REAL,
    quality INTEGER NOT NULL,
    source TEXT NOT NULL,
    pings TEXT NOT NULL
  )`);
  conn.executeSync('CREATE INDEX IF NOT EXISTS idx_meas_time ON measurements(timestamp)');
  conn.executeSync('CREATE INDEX IF NOT EXISTS idx_meas_geo ON measurements(latitude, longitude)');
  conn.executeSync('CREATE INDEX IF NOT EXISTS idx_meas_session ON measurements(session_id)');
  conn.executeSync(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
}

// ---------- Sesiones ----------

export async function createSession(label: string): Promise<Session> {
  const startedAt = Date.now();
  const res = await getDb().execute(
    'INSERT INTO sessions (started_at, label) VALUES (?, ?)',
    [startedAt, label],
  );
  return { id: Number(res.insertId), startedAt, label };
}

export async function listSessions(): Promise<Session[]> {
  const res = await getDb().execute(`
    SELECT s.id, s.started_at, s.label, COUNT(m.id) AS count
    FROM sessions s LEFT JOIN measurements m ON m.session_id = s.id
    GROUP BY s.id HAVING count > 0 ORDER BY s.started_at DESC`);
  return res.rows.map(r => ({
    id: Number(r.id),
    startedAt: Number(r.started_at),
    label: String(r.label),
    count: Number(r.count),
  }));
}

/** Las mediciones en segundo plano se agrupan en una sesión por día. */
export async function getBackgroundSession(): Promise<Session> {
  const label = `Background ${new Date().toLocaleDateString('es-AR')}`;
  const res = await getDb().execute(
    'SELECT id, started_at, label FROM sessions WHERE label = ? LIMIT 1',
    [label],
  );
  const row = res.rows[0];
  if (row) {
    return { id: Number(row.id), startedAt: Number(row.started_at), label };
  }
  return createSession(label);
}

// ---------- Mediciones ----------

export async function insertMeasurement(m: Measurement): Promise<number> {
  const res = await getDb().execute(
    `INSERT INTO measurements (
      session_id, timestamp, latitude, longitude, accuracy, connection_type, generation,
      network_subtype, operator, signal_dbm, signal_level, wifi_strength,
      rtt_min, rtt_avg, rtt_max, jitter, loss_pct, download_mbps, upload_mbps,
      quality, source, pings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.sessionId, m.timestamp, m.latitude, m.longitude, m.accuracy, m.connectionType,
      m.generation, m.networkSubtype, m.operator, m.signalDbm, m.signalLevel, m.wifiStrength,
      m.rttMin, m.rttAvg, m.rttMax, m.jitter, m.lossPct, m.downloadMbps, m.uploadMbps,
      m.quality, m.source, JSON.stringify(m.pings),
    ],
  );
  return Number(res.insertId);
}

const num = (v: Scalar | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
const str = (v: Scalar | undefined): string | null =>
  v === null || v === undefined ? null : String(v);

function rowToMeasurement(r: Record<string, Scalar>): Measurement {
  return {
    id: Number(r.id),
    sessionId: Number(r.session_id),
    timestamp: Number(r.timestamp),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    accuracy: num(r.accuracy),
    connectionType: String(r.connection_type) as Measurement['connectionType'],
    generation: str(r.generation) as Measurement['generation'],
    networkSubtype: str(r.network_subtype),
    operator: str(r.operator),
    signalDbm: num(r.signal_dbm),
    signalLevel: num(r.signal_level),
    wifiStrength: num(r.wifi_strength),
    rttMin: num(r.rtt_min),
    rttAvg: num(r.rtt_avg),
    rttMax: num(r.rtt_max),
    jitter: num(r.jitter),
    lossPct: Number(r.loss_pct),
    downloadMbps: num(r.download_mbps),
    uploadMbps: num(r.upload_mbps),
    quality: Number(r.quality),
    source: String(r.source) as Measurement['source'],
    pings: JSON.parse(String(r.pings)),
  };
}

export async function queryMeasurements(
  filter: HistoryFilter,
  order: 'ASC' | 'DESC' = 'DESC',
  limit = 5000,
): Promise<Measurement[]> {
  const { where, params } = buildWhere(filter);
  const res = await getDb().execute(
    `SELECT * FROM measurements ${where} ORDER BY timestamp ${order} LIMIT ?`,
    [...params, limit],
  );
  return res.rows.map(rowToMeasurement);
}

export async function deleteAllMeasurements(): Promise<void> {
  await getDb().execute('DELETE FROM measurements');
  await getDb().execute('DELETE FROM sessions');
}

// ---------- Configuración ----------

export async function loadSettings(): Promise<Settings> {
  const res = await getDb().execute("SELECT value FROM settings WHERE key = 'app'");
  const raw = res.rows[0]?.value;
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(String(raw)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await getDb().execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?)",
    [JSON.stringify(settings)],
  );
}
