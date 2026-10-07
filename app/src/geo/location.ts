import Geolocation from '@react-native-community/geolocation';

export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

Geolocation.setRNConfiguration({
  skipPermissionRequests: true, // los permisos se piden en services/permissions.ts
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

let cached: Position | null = null;
const CACHE_MAX_AGE_MS = 30_000;

function request(highAccuracy: boolean, timeout: number): Promise<Position> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      err => reject(new Error(err.message)),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: CACHE_MAX_AGE_MS },
    );
  });
}

/**
 * Devuelve la ubicación actual. Si hay una lectura reciente se reutiliza (caché),
 * y si el GPS no responde a tiempo se intenta con la ubicación por red.
 * Devuelve null si no se pudo obtener (la medición se guarda igual, sin coordenadas).
 */
export async function getPosition(): Promise<Position | null> {
  if (cached && Date.now() - cached.timestamp < CACHE_MAX_AGE_MS) {
    return cached;
  }
  try {
    cached = await request(true, 15_000);
  } catch {
    try {
      cached = await request(false, 10_000);
    } catch {
      return cached;
    }
  }
  return cached;
}
