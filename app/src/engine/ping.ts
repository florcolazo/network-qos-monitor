import TcpSocket from 'react-native-tcp-socket';
import type { PingStats, PingTarget } from '../types';
import { now } from './clock';
import { computePingStats } from './stats';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * "TCP ping": mide el tiempo que tarda el handshake TCP (SYN -> SYN/ACK -> ACK)
 * contra host:puerto. Es un RTT real de red sin necesitar ICMP (que Android
 * no permite a apps sin root). Devuelve null si hubo timeout o error.
 */
export function tcpConnectTime(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<number | null> {
  return new Promise(resolve => {
    let settled = false;
    const start = now();

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };

    const socket = TcpSocket.createConnection(
      { host, port, connectTimeout: timeoutMs },
      () => finish(now() - start),
    );
    socket.on('error', () => finish(null));
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Envía `count` sondas a un host. La primera conexión se descarta como
 * "calentamiento" porque incluye la resolución DNS.
 */
export async function pingHost(
  target: PingTarget,
  count: number,
  timeoutMs: number,
  gapMs = 200,
): Promise<PingStats> {
  await tcpConnectTime(target.host, target.port, timeoutMs);

  const samples: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(await tcpConnectTime(target.host, target.port, timeoutMs));
    if (i < count - 1) await sleep(gapMs);
  }
  return computePingStats(target.host, target.port, samples);
}

/** Corre las sondas contra todos los hosts en paralelo. */
export function pingAll(
  targets: PingTarget[],
  count: number,
  timeoutMs: number,
): Promise<PingStats[]> {
  return Promise.all(targets.map(t => pingHost(t, count, timeoutMs)));
}
