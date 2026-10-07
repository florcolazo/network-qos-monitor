import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { insertMeasurement } from '../db/database';
import { getPosition } from '../geo/location';
import { getCellInfo } from '../native/telephony';
import type {
  CellGeneration,
  CellInfo,
  ConnectionType,
  Measurement,
  MeasurementSource,
  Settings,
} from '../types';
import { pingAll } from './ping';
import { aggregatePings, qualityScore } from './stats';
import { measureThroughput } from './throughput';

export interface NetworkSnapshot {
  connectionType: ConnectionType;
  isConnected: boolean;
  generation: CellGeneration | null;
  subtype: string | null;
  operator: string | null;
  signalDbm: number | null;
  signalLevel: number | null;
  wifiStrength: number | null;
  wifiLinkMbps: number | null;
  ipAddress: string | null;
  cell: CellInfo | null;
}

const KNOWN_TYPES: ConnectionType[] = ['wifi', 'cellular', 'ethernet', 'none', 'unknown'];

/** Combina NetInfo (tipo de conexión, WiFi) con el módulo nativo (datos celulares). */
export function buildSnapshot(state: NetInfoState, cell: CellInfo | null): NetworkSnapshot {
  const type = (KNOWN_TYPES as string[]).includes(state.type)
    ? (state.type as ConnectionType)
    : 'other';

  const snap: NetworkSnapshot = {
    connectionType: type,
    isConnected: state.isConnected === true,
    generation: null,
    subtype: null,
    operator: cell?.operatorName ?? null,
    signalDbm: null,
    signalLevel: null,
    wifiStrength: null,
    wifiLinkMbps: null,
    ipAddress: null,
    cell,
  };

  if (state.type === 'wifi') {
    snap.subtype = state.details.ssid ?? 'WiFi';
    snap.wifiStrength = state.details.strength ?? null;
    snap.wifiLinkMbps = state.details.linkSpeed ?? null;
    snap.ipAddress = state.details.ipAddress ?? null;
  } else if (state.type === 'cellular') {
    const netinfoGen = state.details.cellularGeneration?.toUpperCase() as CellGeneration | undefined;
    snap.generation = cell?.generation ?? netinfoGen ?? null;
    snap.subtype = cell?.networkType ?? null;
    snap.operator = cell?.operatorName ?? state.details.carrier ?? null;
    snap.signalDbm = cell?.signalDbm ?? null;
    snap.signalLevel = cell?.signalLevel ?? null;
  }
  return snap;
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const [state, cell] = await Promise.all([NetInfo.fetch(), getCellInfo()]);
  return buildSnapshot(state, cell);
}

export type MeasurementStep = 'red' | 'ubicacion' | 'ping' | 'throughput' | 'guardando';

export interface RunOptions {
  settings: Settings;
  sessionId: number;
  source: MeasurementSource;
  withThroughput: boolean;
  onStep?: (step: MeasurementStep) => void;
}

/**
 * Ejecuta una medición completa: red + ubicación + pings (+ throughput opcional),
 * calcula el puntaje de calidad y la guarda en SQLite.
 * Todas las operaciones de red/IO son asíncronas y nativas, así que no bloquean la UI.
 */
export async function runMeasurement(opts: RunOptions): Promise<Measurement> {
  const { settings, onStep } = opts;

  onStep?.('red');
  const [net, position] = await Promise.all([
    getNetworkSnapshot(),
    (onStep?.('ubicacion'), getPosition()),
  ]);

  onStep?.('ping');
  const pings = net.isConnected
    ? await pingAll(settings.pingTargets, settings.pingCount, settings.pingTimeoutMs)
    : [];
  const agg = aggregatePings(pings);

  let downloadMbps: number | null = null;
  let uploadMbps: number | null = null;
  if (opts.withThroughput && net.isConnected) {
    onStep?.('throughput');
    const thr = await measureThroughput(
      settings.backendUrl,
      settings.downloadBytes,
      settings.uploadBytes,
    );
    if (thr.error) {
      console.warn('Throughput:', thr.error);
    }
    downloadMbps = thr.downloadMbps;
    uploadMbps = thr.uploadMbps;
  }

  const measurement: Measurement = {
    sessionId: opts.sessionId,
    timestamp: Date.now(),
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    accuracy: position?.accuracy ?? null,
    connectionType: net.connectionType,
    generation: net.generation,
    networkSubtype: net.subtype,
    operator: net.operator,
    signalDbm: net.signalDbm,
    signalLevel: net.signalLevel,
    wifiStrength: net.wifiStrength,
    ...agg,
    downloadMbps,
    uploadMbps,
    quality: qualityScore({ ...agg, downloadMbps }),
    source: opts.source,
    pings,
  };

  onStep?.('guardando');
  measurement.id = await insertMeasurement(measurement);
  return measurement;
}
