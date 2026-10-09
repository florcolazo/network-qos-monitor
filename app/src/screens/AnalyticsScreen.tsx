import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { queryMeasurements } from '../db/database';
import { computeAnalytics, networkLabel, type GroupStats } from '../engine/analytics';
import { qualityColor } from '../engine/stats';
import { useQosStore } from '../store/useQosStore';
import type { Measurement } from '../types';
import { Card, Row, Stat, styles } from '../ui/components';
import { FilterBar } from '../ui/FilterBar';
import { colors } from '../ui/theme';

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <View style={local.barTrack}>
      <View style={[local.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Tabla comparativa por grupo (tipo de red u operador). */
function GroupTable({ groups }: { groups: GroupStats[] }) {
  if (!groups.length) return <Text style={styles.muted}>Sin datos.</Text>;
  return (
    <View>
      <View style={local.tr}>
        <Text style={[local.th, local.colName]}>Red</Text>
        <Text style={local.th}>N</Text>
        <Text style={local.th}>Calidad</Text>
        <Text style={local.th}>RTT</Text>
        <Text style={local.th}>↓ Mbps</Text>
      </View>
      {groups.map(g => (
        <View key={g.key} style={local.tr}>
          <Text style={[local.td, local.colName]} numberOfLines={1}>
            {g.key}
          </Text>
          <Text style={local.td}>{g.count}</Text>
          <Text style={[local.td, { color: g.quality !== null ? qualityColor(g.quality) : colors.muted, fontWeight: '700' }]}>
            {g.quality ?? '—'}
          </Text>
          <Text style={local.td}>{g.rttAvg ?? '—'}</Text>
          <Text style={local.td}>{g.downloadMbps ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function MeasurementSummary({ title, m }: { title: string; m: Measurement }) {
  return (
    <View style={local.summary}>
      <Text style={[local.summaryScore, { color: qualityColor(m.quality) }]}>{m.quality}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{title}</Text>
        <Text style={styles.muted}>
          {fmtDate(m.timestamp)} · {networkLabel(m)} · RTT {m.rttAvg ?? '—'} ms · pérdida {m.lossPct}%
        </Text>
      </View>
    </View>
  );
}

export function AnalyticsScreen() {
  const focused = useIsFocused();
  const filter = useQosStore(s => s.filter);
  const dataVersion = useQosStore(s => s.dataVersion);
  const [rows, setRows] = useState<Measurement[]>([]);

  useEffect(() => {
    if (focused) queryMeasurements(filter).then(setRows);
  }, [focused, filter, dataVersion]);

  const a = useMemo(() => computeAnalytics(rows), [rows]);
  const maxBucket = Math.max(...a.distribution.map(b => b.count));
  const o = a.overall;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card title="Filtros" rf="RF-09 · Tipo de red, fecha y zona">
        <FilterBar />
      </Card>

      <Card title={`Resumen · ${o.count} mediciones`} rf="RF-02 · RF-03 · RF-04 · Promedios del período">
        <Row>
          <Stat label="Calidad prom." value={o.quality} unit="/100" />
          <Stat label="RTT prom." value={o.rttAvg} unit="ms" />
          <Stat label="Jitter prom." value={o.jitter} unit="ms" />
          <Stat label="Pérdida prom." value={o.lossPct} unit="%" />
          <Stat label="Descarga prom." value={o.downloadMbps} unit="Mbps" />
          <Stat label="Subida prom." value={o.uploadMbps} unit="Mbps" />
          <Stat label="Con GPS" value={o.count ? a.withGps : null} />
          <Stat label="En background" value={o.count ? a.background : null} />
        </Row>
      </Card>

      <Card title="Distribución de calidad" rf="Puntaje 0–100 (latencia, jitter, pérdida y throughput)">
        {a.distribution.map(b => (
          <View key={b.label} style={local.bucket}>
            <Text style={[styles.text, local.bucketLabel]}>{b.label}</Text>
            <Bar value={b.count} max={maxBucket} color={b.color} />
            <Text style={[styles.muted, local.bucketCount]}>{b.count}</Text>
          </View>
        ))}
      </Card>

      <Card title="Por tipo de red" rf="RF-01 · WiFi vs 3G / 4G / 5G">
        <GroupTable groups={a.byNetwork} />
      </Card>

      <Card title="Por operador" rf="RF-01 · Operador informado por TelephonyManager">
        <GroupTable groups={a.byOperator} />
      </Card>

      {a.best && a.worst ? (
        <Card title="Extremos">
          <MeasurementSummary title="Mejor medición" m={a.best} />
          <MeasurementSummary title="Peor medición" m={a.worst} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  bucket: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucketLabel: { width: 96 },
  bucketCount: { width: 28, textAlign: 'right' },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, fontSize: 12, color: colors.muted, textAlign: 'right' },
  td: { flex: 1, fontSize: 14, color: colors.text, textAlign: 'right' },
  colName: { flex: 1.6, textAlign: 'left' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  summaryScore: { fontSize: 24, fontWeight: '700', width: 44, textAlign: 'center' },
});
