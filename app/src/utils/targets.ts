import type { PingTarget } from '../types';

/** "host:puerto" por línea -> lista de destinos. Devuelve null si alguna línea es inválida. */
export function parseTargets(text: string): PingTarget[] | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const targets: PingTarget[] = [];
  for (const line of lines) {
    const match = /^([^\s:]+):(\d{1,5})$/.exec(line);
    if (!match) return null;
    const port = Number(match[2]);
    if (port < 1 || port > 65535) return null;
    targets.push({ host: match[1], port });
  }
  return targets;
}
