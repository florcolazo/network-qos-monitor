import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { listSessions, queryMeasurements } from '../db/database';
import { qualityColor } from '../engine/stats';
import { exportMeasurements } from '../services/export';
import { useQosStore } from '../store/useQosStore';
import type { Measurement, Session } from '../types';
import { Button, Card, Chips, styles } from '../ui/components';
import { FilterBar } from '../ui/FilterBar';
import { colors } from '../ui/theme';
import { TimeSeriesChart } from '../ui/TimeSeriesChart';

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function MeasurementRow({ m }: { m: Measurement }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 6, borderRadius: 3, backgroundColor: qualityColor(m.quality) }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          {fmtDate(m.timestamp)} · {m.generation ?? m.connectionType}
          {m.operator ? ` · ${m.operator}` : ''}
          {m.source === 'background' ? ' · 🌙' : ''}
        </Text>
        <Text style={styles.muted}>
          RTT {m.rttAvg ?? '—'} ms · jitter {m.jitter ?? '—'} ms · pérdida {m.lossPct}%
          {m.downloadMbps !== null ? ` · ↓${m.downloadMbps} ↑${m.uploadMbps ?? '—'} Mbps` : ''}
        </Text>
      </View>
      <Text style={[styles.text, { fontWeight: '700', color: qualityColor(m.quality) }]}>{m.quality}</Text>
    </View>
  );
}

export function HistoryScreen() {
  const focused = useIsFocused();
  const filter = useQosStore(s => s.filter);
  const setFilter = useQosStore(s => s.setFilter);
  const dataVersion = useQosStore(s => s.dataVersion);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [rows, setRows] = useState<Measurement[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!focused) return;
    listSessions().then(setSessions);
    queryMeasurements(filter).then(setRows);
  }, [focused, filter, dataVersion]);

  // Los gráficos van en orden cronológico.
  const { latencyData, throughputData } = useMemo(() => {
    const asc = [...rows].reverse();
    return {
      latencyData: asc.map(m => ({ t: m.timestamp, a: m.rttAvg, b: m.jitter })),
      throughputData: asc
        .filter(m => m.downloadMbps !== null || m.uploadMbps !== null)
        .map(m => ({ t: m.timestamp, a: m.downloadMbps, b: m.uploadMbps })),
    };
  }, [rows]);

  const sessionOptions = [
    { value: null as number | null, label: 'Todas las sesiones' },
    ...sessions.map(s => ({ value: s.id as number | null, label: `${s.label} (${s.count})` })),
  ];

  const doExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const path = await exportMeasurements(rows, format);
      Alert.alert('Exportación lista', `${rows.length} mediciones guardadas en:\n${path}`);
    } catch (e) {
      Alert.alert('Error al exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <Card title="Filtros">
        <FilterBar />
        <Chips options={sessionOptions} value={filter.sessionId} onChange={sessionId => setFilter({ sessionId })} />
      </Card>

      <Card title="Latencia">
        <TimeSeriesChart
          data={latencyData}
          unit="ms"
          series={[
            { label: 'RTT promedio', color: colors.latency },
            { label: 'Jitter', color: colors.jitter },
          ]}
        />
      </Card>

      <Card title="Throughput">
        <TimeSeriesChart
          data={throughputData}
          unit="Mbps"
          series={[
            { label: 'Descarga', color: colors.download },
            { label: 'Subida', color: colors.upload },
          ]}
        />
      </Card>

      <Card title={`Mediciones (${rows.length})`}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Exportar CSV" variant="secondary" onPress={() => doExport('csv')} disabled={!rows.length} loading={exporting} />
          <Button title="Exportar JSON" variant="secondary" onPress={() => doExport('json')} disabled={!rows.length} loading={exporting} />
        </View>
      </Card>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={m => String(m.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <MeasurementRow m={item} />}
      ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center' }]}>No hay mediciones con estos filtros.</Text>}
      initialNumToRender={20}
    />
  );
}
