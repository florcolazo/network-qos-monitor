import type { Settings } from './types';

/** Mantener igual a versionName en android/app/build.gradle. */
export const APP_VERSION = '0.2.0';

export const DEFAULT_SETTINGS: Settings = {
  pingTargets: [
    { host: '1.1.1.1', port: 443 },
    { host: '8.8.8.8', port: 53 },
    { host: 'www.google.com', port: 443 },
  ],
  pingCount: 10,
  pingTimeoutMs: 2000,
  // 10.0.2.2 es el host de la PC vista desde el emulador de Android.
  // En un teléfono real usar la IP de la PC en la red local o la URL del despliegue.
  backendUrl: 'http://10.0.2.2:3000',
  downloadBytes: 10 * 1024 * 1024,
  uploadBytes: 2 * 1024 * 1024,
  sessionIntervalSec: 30,
  backgroundEnabled: false,
  backgroundIntervalMin: 15,
  notifyRttMs: 300,
  notifyLossPct: 20,
};
