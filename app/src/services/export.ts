import * as RNFS from '@dr.pogodin/react-native-fs';
import { Platform, Share } from 'react-native';
import type { Measurement } from '../types';
import { toCsv, toJson } from '../utils/csv';

/**
 * Guarda el archivo en Descargas (Android) o en Documentos (iOS)
 * y abre el diálogo para compartirlo. Devuelve la ruta del archivo.
 */
export async function exportMeasurements(
  rows: Measurement[],
  format: 'csv' | 'json',
): Promise<string> {
  const content = format === 'csv' ? toCsv(rows) : toJson(rows);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `qos-mediciones-${stamp}.${format}`;

  const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  let path = `${dir}/${name}`;
  try {
    await RNFS.writeFile(path, content, 'utf8');
  } catch {
    // Si no se puede escribir en Descargas, usar la carpeta externa de la app.
    path = `${RNFS.ExternalDirectoryPath}/${name}`;
    await RNFS.writeFile(path, content, 'utf8');
  }
  if (Platform.OS === 'android') {
    RNFS.scanFile(path).catch(() => {});
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { url: `file://${path}`, title: name }
      : // Android no comparte archivos sin FileProvider: se comparte el contenido como texto
        // (si es muy grande, sólo la ruta, para no superar el límite del Intent).
        { message: content.length < 300_000 ? content : `Archivo exportado: ${path}`, title: name },
  );
  return path;
}
