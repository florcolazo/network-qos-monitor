import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../config';
import { createSession, loadSettings, saveSettings } from '../db/database';
import {
  buildSnapshot,
  getNetworkSnapshot,
  runMeasurement,
  type MeasurementStep,
  type NetworkSnapshot,
} from '../engine/measurement';
import { configureBackground } from '../services/background';
import { setupNotifications } from '../services/notifications';
import { requestPermissions, type PermissionState } from '../services/permissions';
import type { HistoryFilter, Measurement, Session, Settings } from '../types';

interface QosState {
  ready: boolean;
  permissions: PermissionState | null;
  settings: Settings;
  network: NetworkSnapshot | null;

  running: boolean;
  step: MeasurementStep | null;
  last: Measurement | null;
  error: string | null;

  /** Sesión a la que se asocian las mediciones manuales / de monitoreo. */
  session: Session | null;
  monitoring: boolean;

  filter: HistoryFilter;
  /** Se incrementa con cada medición nueva para que las pantallas recarguen datos. */
  dataVersion: number;

  init: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
  measure: (withThroughput: boolean) => Promise<void>;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setFilter: (patch: Partial<HistoryFilter>) => void;
  bumpData: () => void;
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeNetInfo: (() => void) | null = null;

const timeLabel = () =>
  new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const useQosStore = create<QosState>((set, get) => ({
  ready: false,
  permissions: null,
  settings: DEFAULT_SETTINGS,
  network: null,
  running: false,
  step: null,
  last: null,
  error: null,
  session: null,
  monitoring: false,
  filter: { network: 'all', date: 'all', bbox: null, sessionId: null },
  dataVersion: 0,

  init: async () => {
    if (get().ready) return;
    const [permissions, settings] = await Promise.all([requestPermissions(), loadSettings()]);
    set({ permissions, settings, ready: true });
    setupNotifications().catch(() => {});
    configureBackground(settings.backgroundEnabled, settings.backgroundIntervalMin).catch(e =>
      console.warn('BackgroundFetch', e),
    );

    unsubscribeNetInfo?.();
    unsubscribeNetInfo = NetInfo.addEventListener(state => {
      set(s => ({ network: buildSnapshot(state, s.network?.cell ?? null) }));
      get().refreshNetwork();
    });
    await get().refreshNetwork();
  },

  refreshNetwork: async () => {
    set({ network: await getNetworkSnapshot() });
  },

  measure: async withThroughput => {
    if (get().running) return;
    set({ running: true, error: null });
    try {
      let session = get().session;
      if (!session) {
        session = await createSession(`Manual ${timeLabel()}`);
        set({ session });
      }
      const m = await runMeasurement({
        settings: get().settings,
        sessionId: session.id,
        source: get().monitoring ? 'session' : 'manual',
        withThroughput,
        onStep: step => set({ step }),
      });
      set(s => ({ last: m, dataVersion: s.dataVersion + 1 }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ running: false, step: null });
    }
  },

  /** Inicia una sesión de monitoreo: mide cada N segundos mientras la app está abierta. */
  startMonitoring: async () => {
    const session = await createSession(`Sesión ${timeLabel()}`);
    set({ session, monitoring: true });
    const tick = () => get().measure(true);
    tick();
    monitorTimer = setInterval(tick, get().settings.sessionIntervalSec * 1000);
  },

  stopMonitoring: () => {
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = null;
    // La próxima medición manual crea una sesión nueva.
    set({ monitoring: false, session: null });
  },

  updateSettings: async patch => {
    const prev = get().settings;
    const settings = { ...prev, ...patch };
    set({ settings });
    await saveSettings(settings);
    if (
      prev.backgroundEnabled !== settings.backgroundEnabled ||
      prev.backgroundIntervalMin !== settings.backgroundIntervalMin
    ) {
      await configureBackground(settings.backgroundEnabled, settings.backgroundIntervalMin);
    }
  },

  setFilter: patch => set(s => ({ filter: { ...s.filter, ...patch } })),
  bumpData: () => set(s => ({ dataVersion: s.dataVersion + 1 })),
}));
