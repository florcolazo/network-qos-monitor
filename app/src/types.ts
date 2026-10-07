export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'none'
  | 'unknown'
  | 'other';

export type CellGeneration = '2G' | '3G' | '4G' | '5G';

/** Datos devueltos por el módulo nativo TelephonyModule (Android). */
export interface CellInfo {
  simReady: boolean;
  operatorName?: string | null;
  mcc?: string;
  mnc?: string;
  isRoaming?: boolean;
  networkType?: string; // LTE, NR, HSPA, ...
  generation?: CellGeneration | null;
  signalLevel?: number; // 0..4
  signalDbm?: number;
  asuLevel?: number;
  cellTech?: string;
  rsrp?: number;
  rsrq?: number;
  cellId?: number;
  pci?: number;
}

export interface PingTarget {
  host: string;
  port: number;
}

export interface PingStats {
  host: string;
  port: number;
  sent: number;
  received: number;
  lossPct: number;
  min: number | null;
  avg: number | null;
  max: number | null;
  jitter: number | null;
  samples: (number | null)[];
}

export interface ThroughputResult {
  downloadMbps: number | null;
  uploadMbps: number | null;
  downloadBytes: number;
  uploadBytes: number;
  error?: string;
}

export type MeasurementSource = 'manual' | 'session' | 'background';

export interface Measurement {
  id?: number;
  sessionId: number;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  connectionType: ConnectionType;
  /** 2G/3G/4G/5G para celular; null para WiFi. */
  generation: CellGeneration | null;
  /** Subtipo técnico (LTE, NR, HSPA...) o SSID en WiFi. */
  networkSubtype: string | null;
  operator: string | null;
  signalDbm: number | null;
  signalLevel: number | null;
  wifiStrength: number | null;
  rttMin: number | null;
  rttAvg: number | null;
  rttMax: number | null;
  jitter: number | null;
  lossPct: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  /** Puntaje 0..100 usado como peso del heatmap. */
  quality: number;
  source: MeasurementSource;
  pings: PingStats[];
}

export interface Session {
  id: number;
  startedAt: number;
  label: string;
  count?: number;
}

export interface Settings {
  pingTargets: PingTarget[];
  pingCount: number;
  pingTimeoutMs: number;
  backendUrl: string;
  downloadBytes: number;
  uploadBytes: number;
  sessionIntervalSec: number;
  backgroundEnabled: boolean;
  backgroundIntervalMin: number;
  notifyRttMs: number;
  notifyLossPct: number;
}

export type NetworkFilter = 'all' | 'wifi' | 'cellular' | CellGeneration;
export type DatePreset = 'all' | 'today' | '7d' | '30d';

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface HistoryFilter {
  network: NetworkFilter;
  date: DatePreset;
  /** Si está definido, sólo mediciones dentro del área visible del mapa. */
  bbox: BBox | null;
  sessionId: number | null;
}
