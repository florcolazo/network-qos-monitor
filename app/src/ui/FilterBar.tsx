import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQosStore } from '../store/useQosStore';
import type { DatePreset, NetworkFilter } from '../types';
import { Chips, styles } from './components';
import { colors } from './theme';

const NETWORK_OPTIONS: { value: NetworkFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'cellular', label: 'Celular' },
  { value: '3G', label: '3G' },
  { value: '4G', label: '4G' },
  { value: '5G', label: '5G' },
];

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

/** Filtros de historial (RF-09): tipo de red, rango de fechas y zona geográfica. */
export function FilterBar() {
  const filter = useQosStore(s => s.filter);
  const setFilter = useQosStore(s => s.setFilter);

  return (
    <View style={{ gap: 6 }}>
      <Chips options={NETWORK_OPTIONS} value={filter.network} onChange={network => setFilter({ network })} />
      <Chips options={DATE_OPTIONS} value={filter.date} onChange={date => setFilter({ date })} />
      {filter.bbox ? (
        <Pressable onPress={() => setFilter({ bbox: null })}>
          <Text style={[styles.muted, { color: colors.primary }]}>
            Zona: área seleccionada en el mapa ✕ (tocar para quitar)
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
