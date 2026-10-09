# Network QoS Monitor

Aplicación móvil (React Native CLI) que mide, guarda y muestra la calidad de la conexión de datos del dispositivo: tipo de red, latencia, jitter, pérdida de paquetes y throughput. Cada medición queda georreferenciada y se muestra en un mapa de calor de cobertura personal.

Trabajo Práctico 01 — Desarrollo de Aplicaciones Móviles 2026 — Licenciatura en Sistemas de Información, FCyT – Sede Concepción del Uruguay.

```
.
├── app/        Aplicación React Native (Android)
└── backend/    Backend de referencia para el test de throughput (Node.js + Express)
```

---

## 1. Requisitos cubiertos

| ID | Requisito | Dónde está implementado |
|----|-----------|-------------------------|
| RF-01 | Tipo de red y operador | `NetInfo` + módulo nativo Kotlin `TelephonyModule` → pantalla **Monitor** |
| RF-02 | RTT contra ≥3 hosts configurables, con min/avg/max/jitter | `src/engine/ping.ts` (sockets TCP) + `stats.ts`; hosts en **Ajustes** |
| RF-03 | Test de descarga/subida en Mbps | `src/engine/throughput.ts` contra `backend/` |
| RF-04 | Timestamp y coordenadas GPS en cada medición | `src/engine/measurement.ts` + `src/geo/location.ts` |
| RF-05 | Mapa con heatmap de calidad | Pantalla **Mapa** (`react-native-maps` → `Heatmap` + marcadores) |
| RF-06 | Series temporales por sesión | Pantalla **Historial** (`victory-native`) |
| RF-07 | Mediciones en background y notificación de degradación | `src/services/background.ts` + `notifications.ts` |
| RF-08 | Exportar a CSV/JSON | Botones en **Historial** (`src/services/export.ts`) |
| RF-09 | Filtros por tipo de red, fecha y zona | `FilterBar` + botón «Filtrar historial por esta zona» en **Mapa** |

Además, la pestaña **Analítica** resume el historial filtrado: promedios por tipo de red y por operador, distribución de calidad y la mejor y peor medición (`src/engine/analytics.ts`). En la app, cada tarjeta indica con una etiqueta qué requisito (RF-xx) cubre.

---

## 2. Arquitectura

Arquitectura en capas, como propone la consigna:

```
┌───────────────────────── Presentation ─────────────────────────┐
│  screens/ Monitor · Mapa · Historial · Analítica · Ajustes   ui/ │
└───────────────▲───────────────────────────────────────────────┘
                │ estado reactivo (Zustand: store/useQosStore.ts)
┌───────────────┴──────────── Measurement Engine ────────────────┐
│ engine/measurement.ts  orquesta una medición completa          │
│ engine/ping.ts         sondas TCP (react-native-tcp-socket)    │
│ engine/throughput.ts   descarga/subida (RNFS, nativo)          │
│ engine/stats.ts        min/avg/max/jitter/pérdida, puntaje     │
│ services/background.ts muestreo periódico (background-fetch)   │
└──────┬──────────────────────┬────────────────────────┬─────────┘
       │                      │                        │
┌──────▼──────┐   ┌───────────▼──────────┐   ┌─────────▼─────────┐
│Native Bridge│   │     Geo Layer        │   │ Persistence Layer │
│ native/     │   │ geo/location.ts      │   │ db/database.ts    │
│ telephony.ts│   │ (caché 30 s,         │   │ db/filters.ts     │
│   ▼ Kotlin  │   │  fallback por red)   │   │ SQLite (op-sqlite)│
│TelephonyMod.│   └──────────────────────┘   └───────────────────┘
└─────────────┘
```

### 2.1 Native Bridge — `TelephonyModule` (Kotlin)

`app/android/app/src/main/java/com/networkqosmonitor/telephony/`

Es un módulo nativo propio que usa `android.telephony.TelephonyManager` y expone `getCellInfo(): Promise<CellInfo>` con estos datos:

- operador, MCC/MNC y roaming;
- tipo de red de datos (`LTE`, `NR`, `HSPA`, …) y generación (2G/3G/4G/5G);
- nivel de señal 0–4, dBm y ASU (`SignalStrength`, API 28+);
- de la celda servidora (`getAllCellInfo`): RSRP, RSRQ, Cell ID y PCI (LTE/NR/WCDMA/GSM).

Se registra en `MainApplication.kt` mediante `TelephonyPackage`. Con la *New Architecture* activada, funciona a través de la capa de interoperabilidad de TurboModules.

### 2.2 Measurement Engine

**Latencia (RTT), jitter y pérdida.** Android no permite enviar ICMP a una app sin root, así que hacemos un **"TCP ping"**: medimos cuánto tarda el handshake TCP (SYN → SYN/ACK) contra `host:puerto`.
- Por defecto se mandan 10 sondas a cada host, separadas 200 ms. Los hosts se miden en paralelo.
- La primera conexión se descarta como calentamiento, porque incluye la resolución DNS.
- Una sonda sin respuesta en `pingTimeoutMs` (2 s) cuenta como paquete perdido.
- **Jitter** = promedio de |RTTᵢ − RTTᵢ₋₁| entre muestras consecutivas (variación de retardo, en línea con RFC 3550).

**Throughput.** Se mide contra el backend de referencia:
- *Descarga*: `GET /download?bytes=N`. La transferencia la hace código nativo (`RNFS.downloadFile`, que escribe directo a un archivo temporal), así el hilo de JS no procesa los bytes. **Corrección por payload**: el cronómetro arranca cuando llegan los headers (callback `begin`). Así se descartan el handshake y el TTFB, y se divide por los bytes realmente recibidos.
- *Subida*: `POST /upload` con un archivo de N bytes. El servidor responde cuántos bytes recibió y cuánto tardó (`serverMs`), y con eso se calcula Mbps sin contar el establecimiento de la conexión.

**Puntaje de calidad (0–100).** Es el peso del heatmap y el color de los marcadores:

| Componente | Peso | 100 pts | 0 pts |
|---|---|---|---|
| RTT promedio | 50 % | ≤ 30 ms | ≥ 500 ms |
| Jitter | 20 % | ≤ 5 ms | ≥ 100 ms |
| Pérdida | 30 % | 0 % | ≥ 20 % |
| (si hay test) Descarga | 30 % del total | ≥ 50 Mbps | 0 Mbps |

**Sin bloquear la UI.** Sockets, descargas, GPS y SQLite son operaciones nativas asíncronas: el hilo de JS sólo recibe los resultados. El estado se publica en un store **Zustand** y las pantallas se suscriben sólo a lo que usan.

### 2.3 Interfaz

- Tema oscuro y cinco pestañas: Monitor, Mapa, Historial, Analítica y Ajustes.
- **Heatmap**: se dibuja una capa por nivel de calidad (Excelente, Buena, Regular, Mala), cada una de su color y con bordes que se desvanecen. Así el color indica la calidad medida y no la cantidad de puntos acumulados.
- La versión de la app se muestra al pie de **Ajustes** y coincide con `versionName` del APK.

### 2.4 Sesiones

- **Test completo / Sólo latencia**: hace una medición. Las mediciones manuales se agrupan en una sesión «Manual dd/mm hh:mm».
- **Iniciar sesión**: mide cada N segundos (30 por defecto) mientras la app está abierta y agrupa todo en una sesión. Los gráficos del historial se pueden ver por sesión.
- Las mediciones en **segundo plano** se agrupan en una sesión «Background dd/mm/aaaa» por día.

### 2.5 Background y notificaciones

`react-native-background-fetch` corre cada ≥ 15 min (es el mínimo que permite el sistema) con `stopOnTerminate: false` y `enableHeadless: true`. Con la app cerrada, Android ejecuta la *headless task* registrada en `index.js`. Cada ejecución hace una medición liviana (red + GPS + ping, sin throughput, para no gastar datos). Si el RTT o la pérdida superan los umbrales configurados, o no hay conexión, muestra una notificación local con **Notifee**.

### 2.6 Persistencia

SQLite mediante `@op-engineering/op-sqlite`. Tablas:

- `sessions(id, started_at, label)`
- `measurements(...)`: una fila por medición con todas las métricas; el detalle por host se guarda en JSON. Tiene índices por fecha, por lat/lon y por sesión.
- `settings(key, value)`: la configuración del usuario, que también lee la tarea en background.

Los filtros (RF-09) se traducen a un `WHERE` parametrizado en `db/filters.ts`. La zona geográfica es un bounding box que se toma del área visible del mapa.

---

## 3. Decisiones de diseño respecto al stack sugerido

| Sugerido | Usado | Motivo |
|---|---|---|
| `react-native-geolocation-service` | `@react-native-community/geolocation` | El sugerido no se actualiza desde 2022. El de la comunidad está mantenido y es compatible con RN 0.87. Ofrece la misma API, con caché propia de 30 s y fallback a ubicación por red. |
| `react-native-sqlite-storage` / WatermelonDB | `@op-engineering/op-sqlite` | Sigue siendo SQLite, pero mantenido, con soporte para la New Architecture y consultas ejecutadas fuera del hilo de JS. |
| — | `@dr.pogodin/react-native-fs` | Para hacer las transferencias de throughput en código nativo y escribir los exports. Es el fork mantenido de `react-native-fs`. |
| `victory-native` | `victory-native` (v42, Skia) | La versión actual dibuja con Skia, que funciona bien con muchos puntos. |
| Zustand / Redux / Context | Zustand | Es el más simple: no necesita providers y la tarea headless puede acceder a él desde fuera de React. |

---

## 4. Cómo ejecutar

### 4.1 Backend

```bash
cd backend
npm install
npm start                    # http://0.0.0.0:3000
# o con Docker:
docker compose up -d --build
```

Endpoints:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/download?bytes=N` | Devuelve N bytes aleatorios (no comprimibles). Por defecto 10 MB, máximo 100 MB |
| POST | `/upload` | Recibe el cuerpo y responde `{ received, serverMs }` |

**Despliegue.** La imagen Docker es autocontenida (`node:22-alpine`) y escucha en `$PORT`. Se puede desplegar en cualquier servicio de contenedores (Render, Railway, Fly.io, una VPS con Docker, etc.). Para medir throughput real por datos móviles conviene desplegarlo en un servidor público. En la red local sólo se mide el tramo WiFi.

### 4.2 App (Android)

Requisitos: Node ≥ 22, JDK 17–21, Android SDK (Platform 37, Build-Tools 37, NDK 27.1) y un dispositivo o emulador.

1. Crear `app/android/local.properties`:
   ```properties
   sdk.dir=/ruta/a/Android/Sdk
   MAPS_API_KEY=tu_clave_de_google_maps
   ```
   La clave de Google Maps se obtiene en Google Cloud Console, habilitando *Maps SDK for Android*.
2. Instalar y ejecutar:
   ```bash
   cd app
   npm install
   npm run android
   ```
3. En **Ajustes → URL del backend**, poner la URL del backend:
   - emulador: `http://10.0.2.2:3000` (valor por defecto);
   - teléfono real en la misma WiFi: `http://<IP-de-la-PC>:3000`;
   - backend desplegado: su URL pública.

   Con «Probar conexión» se verifica que responda.

**APK de prueba:**
```bash
cd app/android
./gradlew assembleRelease     # app/android/app/build/outputs/apk/release/app-release.apk
```
(El template firma el build *release* con la clave de debug, que alcanza para un APK de prueba.)

### 4.3 Tests

```bash
cd app
npm test          # cálculo de estadísticas, puntaje, filtros SQL, CSV, parseo de hosts
npx tsc --noEmit
```

---

## 5. Limitaciones conocidas

- **iOS**: no hay módulo nativo de CoreTelephony. Apple ya no expone la intensidad de señal y, desde iOS 16, el nombre del operador viene vacío. En iOS la app funcionaría sólo con NetInfo (tipo de red), y el background quedaría limitado por las políticas de BGTaskScheduler. El desarrollo y las pruebas se hicieron en Android.
- **5G NSA**: en redes 5G *non-standalone*, `getDataNetworkType()` informa `LTE`. Para detectar NSA habría que escuchar `TelephonyDisplayInfo` con un `TelephonyCallback`.
- **TCP ping vs ICMP**: el RTT incluye el handshake TCP y una pequeña sobrecarga del puente nativo→JS (≈1 ms). Algunos hosts o firewalls pueden limitar conexiones repetidas.
- **Throughput**: es una única conexión HTTP, no varias en paralelo como Speedtest, así que en enlaces muy rápidos puede subestimar la capacidad. El resultado depende de dónde esté desplegado el backend.
- **Background**: Android decide cuándo ejecutar las tareas (Doze, App Standby, restricciones del fabricante). El intervalo mínimo es de 15 min y puede ser mayor. Algunos fabricantes (Xiaomi, Huawei, Samsung) matan las tareas si no se desactiva la optimización de batería para la app.
- **Exportar en Android**: el archivo se guarda en *Descargas* (o en la carpeta externa de la app si no hay acceso). El diálogo de compartir envía el contenido como texto.
- **Mapa**: necesita una clave de Google Maps válida. Sin ella el mapa se ve gris, aunque los datos se siguen guardando.
