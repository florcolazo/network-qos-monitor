import BackgroundFetch, { type HeadlessEvent } from 'react-native-background-fetch';
import { getBackgroundSession, loadSettings } from '../db/database';
import { runMeasurement } from '../engine/measurement';
import { degradationReason } from '../engine/stats';
import type { Measurement } from '../types';
import { notifyDegradation } from './notifications';

/**
 * Medición liviana para segundo plano: sólo red + ubicación + pings
 * (sin test de throughput para no consumir datos ni batería).
 */
export async function backgroundMeasurement(): Promise<Measurement | null> {
  const settings = await loadSettings();
  if (!settings.backgroundEnabled) return null;

  const session = await getBackgroundSession();
  const m = await runMeasurement({
    settings,
    sessionId: session.id,
    source: 'background',
    withThroughput: false,
  });

  const reason = degradationReason(m, settings);
  if (reason) {
    const detail =
      m.rttAvg !== null
        ? `RTT ${m.rttAvg} ms · jitter ${m.jitter} ms · pérdida ${m.lossPct}%`
        : `Conexión: ${m.connectionType}`;
    await notifyDegradation(reason, detail);
  }
  return m;
}

async function onFetch(taskId: string) {
  try {
    await backgroundMeasurement();
  } catch (e) {
    console.warn('[BackgroundFetch] error', e);
  }
  BackgroundFetch.finish(taskId);
}

/** Configura el muestreo periódico. Android lo ejecuta aunque la app esté cerrada. */
export async function configureBackground(enabled: boolean, intervalMin: number) {
  if (!enabled) {
    await BackgroundFetch.stop();
    return;
  }
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: Math.max(15, intervalMin), // mínimo impuesto por el SO
      stopOnTerminate: false, // seguir con la app cerrada (Android)
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE, // medir aun sin red, para registrar el corte
    },
    onFetch,
    taskId => BackgroundFetch.finish(taskId),
  );
  await BackgroundFetch.start();
}

/** Tarea "headless": la invoca Android cuando la app fue cerrada. Se registra en index.js. */
export async function headlessTask(event: HeadlessEvent) {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }
  await onFetch(event.taskId);
}
