import * as RNFS from '@dr.pogodin/react-native-fs';
import type { ThroughputResult } from '../types';
import { now } from './clock';
import { toMbps } from './stats';

const trimSlash = (url: string) => url.replace(/\/+$/, '');

/**
 * Test de descarga. La transferencia la hace el código nativo (RNFS escribe
 * directamente a un archivo temporal), así el hilo de JS no procesa los bytes.
 *
 * Corrección por payload: el cronómetro arranca cuando llegan los headers
 * (callback `begin`), descartando el handshake TCP y el tiempo hasta el primer byte;
 * se divide por los bytes realmente escritos.
 */
export async function measureDownload(
  baseUrl: string,
  bytes: number,
): Promise<{ mbps: number | null; bytes: number }> {
  const toFile = `${RNFS.CachesDirectoryPath}/qos-download.bin`;
  let firstByteAt: number | null = null;
  const requestedAt = now();

  const { promise } = RNFS.downloadFile({
    fromUrl: `${trimSlash(baseUrl)}/download?bytes=${bytes}&t=${Date.now()}`,
    toFile,
    cacheable: false,
    connectionTimeout: 10000,
    readTimeout: 30000,
    begin: () => {
      firstByteAt = now();
    },
  });
  const result = await promise;
  const end = now();
  RNFS.unlink(toFile).catch(() => {});

  if (result.statusCode !== 200) {
    throw new Error(`Descarga: HTTP ${result.statusCode}`);
  }
  const elapsed = end - (firstByteAt ?? requestedAt);
  return { mbps: toMbps(result.bytesWritten, elapsed), bytes: result.bytesWritten };
}

let uploadFileReady: { path: string; bytes: number } | null = null;

/** Genera (una sola vez) un archivo de `bytes` bytes para la subida. */
async function getUploadFile(bytes: number): Promise<string> {
  const path = `${RNFS.CachesDirectoryPath}/qos-upload-${bytes}.bin`;
  if (uploadFileReady?.path === path && (await RNFS.exists(path))) {
    return path;
  }
  // Bloque de 48 KB (múltiplo de 3 para que el base64 no lleve relleno)
  // que se repite hasta completar el tamaño.
  const blockBytes = 48 * 1024;
  let block = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < (blockBytes / 3) * 4; i++) {
    block += alphabet[Math.floor(Math.random() * 64)];
  }
  await RNFS.writeFile(path, '', 'utf8');
  for (let written = 0; written < bytes; written += blockBytes) {
    await RNFS.appendFile(path, block, 'base64');
  }
  uploadFileReady = { path, bytes };
  return path;
}

/**
 * Test de subida contra POST /upload. El backend responde cuántos bytes recibió
 * y cuánto tardó en recibirlos (`serverMs`). Se usa el tiempo del servidor
 * porque excluye el establecimiento de la conexión; si no viene, se usa el del cliente.
 */
export async function measureUpload(
  baseUrl: string,
  bytes: number,
): Promise<{ mbps: number | null; bytes: number }> {
  const filepath = await getUploadFile(bytes);
  const start = now();
  const { promise } = RNFS.uploadFiles({
    toUrl: `${trimSlash(baseUrl)}/upload`,
    files: [{ name: 'payload', filename: 'payload.bin', filepath, filetype: 'application/octet-stream' }],
    method: 'POST',
  });
  const result = await promise;
  const clientMs = now() - start;

  if (result.statusCode !== 200) {
    throw new Error(`Subida: HTTP ${result.statusCode}`);
  }
  const body = JSON.parse(result.body) as { received: number; serverMs?: number };
  const ms = body.serverMs && body.serverMs > 0 ? body.serverMs : clientMs;
  return { mbps: toMbps(body.received, ms), bytes: body.received };
}

export async function measureThroughput(
  baseUrl: string,
  downloadBytes: number,
  uploadBytes: number,
): Promise<ThroughputResult> {
  const result: ThroughputResult = {
    downloadMbps: null,
    uploadMbps: null,
    downloadBytes: 0,
    uploadBytes: 0,
  };
  try {
    const down = await measureDownload(baseUrl, downloadBytes);
    result.downloadMbps = down.mbps;
    result.downloadBytes = down.bytes;
    const up = await measureUpload(baseUrl, uploadBytes);
    result.uploadMbps = up.mbps;
    result.uploadBytes = up.bytes;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}
