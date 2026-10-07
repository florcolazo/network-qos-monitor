import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { queryMeasurements } from '../db/database';
import { qualityColor } from '../engine/stats';
import { useQosStore } from '../store/useQosStore';
import type { Measurement } from '../types';
import { Button, styles as ui } from '../ui/components';
import { FilterBar } from '../ui/FilterBar';
import { colors } from '../ui/theme';

// Concepción del Uruguay como posición inicial si todavía no hay mediciones.
const DEFAULT_REGION: Region = {
  latitude: -32.4846,
  longitude: -58.2321,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MAX_MARKERS = 300;

export function MapScreen() {
  const focused = useIsFocused();
  const filter = useQosStore(s => s.filter);
  const dataVersion = useQosStore(s => s.dataVersion);
  const setFilter = useQosStore(s => s.setFilter);

  const [rows, setRows] = useState<Measurement[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);

  // El mapa muestra todas las mediciones que cumplen el filtro de red/fecha;
  // el filtro de zona se aplica al historial.
  useEffect(() => {
    if (!focused) return;
    queryMeasurements({ ...filter, bbox: null }).then(r =>
      setRows(r.filter(m => m.latitude !== null && m.longitude !== null)),
    );
  }, [focused, filter, dataVersion]);

  const heatPoints = useMemo(
    () =>
      rows.map(m => ({
        latitude: m.latitude!,
        longitude: m.longitude!,
        // Peso mínimo para que las zonas sin conexión también se vean.
        weight: Math.max(m.quality, 5),
      })),
    [rows],
  );

  // initialRegion sólo se usa al montar el MapView; la `key` del mapa fuerza
  // un único remontaje cuando llegan las primeras mediciones, para centrarlo en ellas.
  const first = rows[0];
  const initialRegion: Region = first
    ? { latitude: first.latitude!, longitude: first.longitude!, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : DEFAULT_REGION;

  const filterByVisibleArea = () => {
    if (!region) return;
    setFilter({
      bbox: {
        minLat: region.latitude - region.latitudeDelta / 2,
        maxLat: region.latitude + region.latitudeDelta / 2,
        minLon: region.longitude - region.longitudeDelta / 2,
        maxLon: region.longitude + region.longitudeDelta / 2,
      },
    });
  };

  return (
    <View style={ui.screen}>
      <MapView
        key={rows.length > 0 ? 'with-data' : 'empty'}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={setRegion}>
        {heatPoints.length > 0 ? (
          <Heatmap
            points={heatPoints}
            radius={40}
            opacity={0.75}
            gradient={{
              colors: ['#d73027', '#fdae61', '#91cf60', '#1a9850'],
              startPoints: [0.05, 0.35, 0.6, 0.9],
              colorMapSize: 256,
            }}
          />
        ) : null}
        {showMarkers
          ? rows.slice(0, MAX_MARKERS).map(m => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.latitude!, longitude: m.longitude! }}
                pinColor={qualityColor(m.quality)}
                title={`Calidad ${m.quality} · ${m.generation ?? m.connectionType}`}
                description={`${new Date(m.timestamp).toLocaleString('es-AR')} · RTT ${m.rttAvg ?? '—'} ms · ↓ ${m.downloadMbps ?? '—'} Mbps`}
              />
            ))
          : null}
      </MapView>

      <View style={[ui.card, local.overlay]}>
        <FilterBar />
        <View style={local.row}>
          <Text style={ui.muted}>
            {rows.length} mediciones · Marcadores
          </Text>
          <Switch value={showMarkers} onValueChange={setShowMarkers} />
        </View>
        <Button title="Filtrar historial por esta zona" variant="secondary" onPress={filterByVisibleArea} />
      </View>

      <View style={[ui.card, local.legend]}>
        <Text style={[ui.muted, { fontSize: 11 }]}>Calidad</Text>
        {[
          ['Excelente', 90],
          ['Buena', 70],
          ['Regular', 50],
          ['Mala', 10],
        ].map(([label, score]) => (
          <Text key={label} style={{ fontSize: 11, color: colors.text }}>
            <Text style={{ color: qualityColor(score as number) }}>●</Text> {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  overlay: { position: 'absolute', top: 8, left: 8, right: 8, padding: 10, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legend: { position: 'absolute', bottom: 16, left: 8, padding: 8, gap: 0 },
});
