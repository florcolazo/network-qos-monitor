import { NativeModules, Platform } from 'react-native';
import type { CellInfo } from '../types';

interface TelephonyModuleSpec {
  getCellInfo(): Promise<CellInfo>;
}

const Native: TelephonyModuleSpec | undefined = NativeModules.TelephonyModule;

/**
 * Lee operador, tipo de red celular y señal desde el módulo nativo de Kotlin.
 * En iOS (sin módulo nativo implementado) o ante un error devuelve null.
 */
export async function getCellInfo(): Promise<CellInfo | null> {
  if (Platform.OS !== 'android' || !Native) {
    return null;
  }
  try {
    return await Native.getCellInfo();
  } catch (e) {
    console.warn('TelephonyModule.getCellInfo falló', e);
    return null;
  }
}
