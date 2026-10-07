// Backend de referencia para el test de throughput del Network QoS Monitor.
//
//   GET  /health                 -> estado del servicio
//   GET  /download?bytes=N       -> devuelve N bytes (payload de tamaño fijo)
//   POST /upload                 -> recibe el cuerpo y responde cuántos bytes llegaron (echo)

const crypto = require('node:crypto');
const express = require('express');

const PORT = Number(process.env.PORT) || 3000;
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_BYTES = 10 * 1024 * 1024; // 10 MB

// Bloque aleatorio (no comprimible) que se repite para armar el payload.
const CHUNK = crypto.randomBytes(1024 * 1024);

const app = express();

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/download', (req, res) => {
  const requested = Number(req.query.bytes) || DEFAULT_BYTES;
  const total = Math.min(Math.max(requested, 1), MAX_BYTES);

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(total),
    'Content-Encoding': 'identity',
  });

  let sent = 0;
  const write = () => {
    while (sent < total) {
      const size = Math.min(CHUNK.length, total - sent);
      const ok = res.write(size === CHUNK.length ? CHUNK : CHUNK.subarray(0, size));
      sent += size;
      if (!ok) {
        res.once('drain', write);
        return;
      }
    }
    res.end();
  };
  write();
});

app.post('/upload', (req, res) => {
  const start = process.hrtime.bigint();
  let received = 0;

  req.on('data', chunk => {
    received += chunk.length;
    if (received > MAX_BYTES) {
      res.status(413).json({ error: 'payload demasiado grande' });
      req.destroy();
    }
  });
  req.on('end', () => {
    const serverMs = Number(process.hrtime.bigint() - start) / 1e6;
    res.json({ received, serverMs });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`QoS backend escuchando en http://0.0.0.0:${PORT}`);
});
