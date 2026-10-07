import { PermissionsAndroid, Platform } from 'react-native';

export interface PermissionState {
  location: boolean;
  phone: boolean;
}

/**
 * Pide los permisos necesarios:
 *  - Ubicación precisa: georreferenciar mediciones y leer la celda servidora.
 *  - Estado del teléfono: tipo de red celular (Android 11+).
 *  - Notificaciones: avisos de degradación (Android 13+), se pide en notifications.ts.
 */
export async function requestPermissions(): Promise<PermissionState> {
  if (Platform.OS !== 'android') {
    return { location: true, phone: true };
  }
  const P = PermissionsAndroid.PERMISSIONS;
  const result = await PermissionsAndroid.requestMultiple([
    P.ACCESS_FINE_LOCATION,
    P.ACCESS_COARSE_LOCATION,
    P.READ_PHONE_STATE,
  ]);
  const granted = PermissionsAndroid.RESULTS.GRANTED;
  return {
    location:
      result[P.ACCESS_FINE_LOCATION] === granted ||
      result[P.ACCESS_COARSE_LOCATION] === granted,
    phone: result[P.READ_PHONE_STATE] === granted,
  };
}
