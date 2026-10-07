import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { qualityColor, qualityLabel } from '../engine/stats';
import type { MeasurementStep } from '../engine/measurement';
import { useQosStore } from '../store/useQosStore';
import { Button, Card, QualityBadge, Row, Stat, styles } from '../ui/components';
import { colors } from '../ui/theme';

const STEP_TEXT: Record<MeasurementStep, string> = {
  red: 'Leyendo estado de la red…',
  ubicacion: 'Obteniendo ubicación…',
  ping: 'Midiendo latencia (TCP)…',
  throughput: 'Test de descarga y subida…',
  guardando: 'Guardando medición…',
};

const CONNECTION_TEXT: Record<string, string> = {
  wifi: 'WiFi',
  cellular: 'Datos móviles',
  ethernet: 'Ethernet',
  none: 'Sin conexión',
  unknown: 'Desconocida',
  other: 'Otra',
};

function SignalBars({ level }: { level: number | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 18 }}>
      {[1, 2, 3, 4].map(i => (
        <View
          key={i}
          style={{
            width: 5,
            height: 4 + i * 3.5,
            borderRadius: 1,
            backgroundColor: level !== null && i <= level ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

export function MonitorScreen() {
  const network = useQosStore(s => s.network);
  const permissions = useQosStore(s => s.permissions);
  const running = useQosStore(s => s.running);
  const step = useQosStore(s => s.step);
  const last = useQosStore(s => s.last);
  const error = useQosStore(s => s.error);
  const monitoring = useQosStore(s => s.monitoring);
  const session = useQosStore(s => s.session);
  const settings = useQosStore(s => s.settings);
  const { measure, startMonitoring, stopMonitoring, refreshNetwork } = useQosStore.getState();

  // La señal celular cambia sin que NetInfo emita eventos: se refresca cada 5 s.
  useEffect(() => {
    const id = setInterval(refreshNetwork, 5000);
    return () => clearInterval(id);
  }, [refreshNetwork]);

  const cell = network?.cell;
  const isCellular = network?.connectionType === 'cellular';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card
        title="Red activa"
        right={isCellular ? <SignalBars level={network?.signalLevel ?? null} /> : null}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
          {network ? CONNECTION_TEXT[network.connectionType] : '…'}
          {network?.generation ? ` · ${network.generation}` : ''}
        </Text>
        <Row>
          {isCellular ? (
            <>
              <Stat label="Operador" value={network?.operator} />
              <Stat label="Tecnología" value={network?.subtype} />
              <Stat label="Señal" value={network?.signalDbm} unit="dBm" />
              <Stat label="RSRP" value={cell?.rsrp} unit="dBm" />
              <Stat label="RSRQ" value={cell?.rsrq} unit="dB" />
              <Stat label="Cell ID" value={cell?.cellId} />
            </>
          ) : (
            <>
              <Stat label="SSID" value={network?.subtype} />
              <Stat label="Intensidad" value={network?.wifiStrength} unit="%" />
              <Stat label="Enlace" value={network?.wifiLinkMbps} unit="Mbps" />
              <Stat label="IP local" value={network?.ipAddress} />
              {cell?.operatorName ? <Stat label="Operador SIM" value={cell.operatorName} /> : null}
            </>
          )}
        </Row>
        {permissions && (!permissions.location || !permissions.phone) ? (
          <Text style={styles.error}>
            Faltan permisos de {!permissions.location ? 'ubicación ' : ''}
            {!permissions.phone ? 'teléfono' : ''}: algunos datos no estarán disponibles.
          </Text>
        ) : null}
      </Card>

      <Card title="Medición">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Test completo" onPress={() => measure(true)} loading={running} disabled={monitoring} />
          <Button
            title="Sólo latencia"
            variant="secondary"
            onPress={() => measure(false)}
            disabled={running || monitoring}
          />
        </View>
        <Button
          title={monitoring ? 'Detener sesión de monitoreo' : `Iniciar sesión (cada ${settings.sessionIntervalSec} s)`}
          variant={monitoring ? 'danger' : 'secondary'}
          onPress={monitoring ? stopMonitoring : startMonitoring}
        />
        {session ? <Text style={styles.muted}>Sesión actual: {session.label}</Text> : null}
        {step ? <Text style={styles.muted}>{STEP_TEXT[step]}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {last ? (
        <Card
          title={`Última medición · ${new Date(last.timestamp).toLocaleTimeString('es-AR')}`}
          right={
            <QualityBadge
              score={last.quality}
              color={qualityColor(last.quality)}
              label={qualityLabel(last.quality, last.rttAvg !== null)}
            />
          }>
          <Row>
            <Stat label="RTT mín" value={last.rttMin} unit="ms" />
            <Stat label="RTT prom" value={last.rttAvg} unit="ms" />
            <Stat label="RTT máx" value={last.rttMax} unit="ms" />
            <Stat label="Jitter" value={last.jitter} unit="ms" />
            <Stat label="Pérdida" value={last.lossPct} unit="%" />
            <Stat label="GPS" value={last.latitude !== null ? `±${Math.round(last.accuracy ?? 0)}` : null} unit="m" />
            <Stat label="Descarga" value={last.downloadMbps} unit="Mbps" />
            <Stat label="Subida" value={last.uploadMbps} unit="Mbps" />
          </Row>

          <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 8 }]}>Detalle por host</Text>
          {last.pings.map(p => (
            <View key={`${p.host}:${p.port}`} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={styles.text}>
                {p.host}:{p.port}
              </Text>
              <Text style={styles.muted}>
                {p.avg !== null
                  ? `min ${p.min} / avg ${p.avg} / max ${p.max} ms · jitter ${p.jitter} ms · pérdida ${p.lossPct}% (${p.received}/${p.sent})`
                  : `sin respuesta (${p.sent} sondas)`}
              </Text>
            </View>
          ))}
        </Card>
      ) : (
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          Todavía no hay mediciones. Tocá "Test completo" para empezar.
        </Text>
      )}
    </ScrollView>
  );
}
