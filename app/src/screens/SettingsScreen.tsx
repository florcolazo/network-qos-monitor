import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { deleteAllMeasurements } from '../db/database';
import { useQosStore } from '../store/useQosStore';
import type { Settings } from '../types';
import { Button, Card, styles } from '../ui/components';
import { parseTargets } from '../utils/targets';

const MB = 1024 * 1024;

function Field({
  label,
  value,
  onChangeText,
  numeric,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
      />
    </View>
  );
}

export function SettingsScreen() {
  const settings = useQosStore(s => s.settings);
  const updateSettings = useQosStore(s => s.updateSettings);
  const bumpData = useQosStore(s => s.bumpData);

  const [form, setForm] = useState(() => toForm(settings));
  const [testing, setTesting] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    const targets = parseTargets(form.targets);
    if (!targets || targets.length < 3) {
      Alert.alert('Hosts inválidos', 'Ingresá al menos 3 hosts con el formato host:puerto, uno por línea.');
      return;
    }
    const n = (s: string, min: number) => Math.max(min, Number(s.replace(',', '.')) || min);
    await updateSettings({
      pingTargets: targets,
      pingCount: Math.round(n(form.pingCount, 3)),
      backendUrl: form.backendUrl.trim(),
      downloadBytes: Math.round(n(form.downloadMb, 0.5) * MB),
      uploadBytes: Math.round(n(form.uploadMb, 0.5) * MB),
      sessionIntervalSec: Math.round(n(form.sessionIntervalSec, 10)),
      backgroundIntervalMin: Math.round(n(form.backgroundIntervalMin, 15)),
      notifyRttMs: n(form.notifyRttMs, 1),
      notifyLossPct: n(form.notifyLossPct, 1),
    });
    Alert.alert('Configuración guardada');
  };

  const testBackend = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${form.backendUrl.replace(/\/+$/, '')}/health`);
      Alert.alert('Backend', res.ok ? 'Conexión correcta ✔' : `Respondió HTTP ${res.status}`);
    } catch (e) {
      Alert.alert('Backend no accesible', e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const clearHistory = () =>
    Alert.alert('Borrar historial', '¿Eliminar todas las mediciones guardadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteAllMeasurements();
          useQosStore.setState({ last: null, session: null });
          bumpData();
        },
      },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card title="Latencia (TCP ping)">
        <Field label="Hosts (host:puerto, uno por línea, mínimo 3)" value={form.targets} onChangeText={set('targets')} multiline />
        <Field label="Sondas por host" value={form.pingCount} onChangeText={set('pingCount')} numeric />
      </Card>

      <Card title="Backend de throughput">
        <Field label="URL del backend" value={form.backendUrl} onChangeText={set('backendUrl')} />
        <Field label="Tamaño de descarga (MB)" value={form.downloadMb} onChangeText={set('downloadMb')} numeric />
        <Field label="Tamaño de subida (MB)" value={form.uploadMb} onChangeText={set('uploadMb')} numeric />
        <Button title="Probar conexión" variant="secondary" onPress={testBackend} loading={testing} />
      </Card>

      <Card title="Monitoreo">
        <Field label="Intervalo de la sesión en primer plano (s)" value={form.sessionIntervalSec} onChangeText={set('sessionIntervalSec')} numeric />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.text}>Mediciones en segundo plano</Text>
          <Switch
            value={settings.backgroundEnabled}
            onValueChange={backgroundEnabled => updateSettings({ backgroundEnabled })}
          />
        </View>
        <Field label="Intervalo en segundo plano (min, mínimo 15)" value={form.backgroundIntervalMin} onChangeText={set('backgroundIntervalMin')} numeric />
        <Field label="Notificar si RTT promedio ≥ (ms)" value={form.notifyRttMs} onChangeText={set('notifyRttMs')} numeric />
        <Field label="Notificar si pérdida ≥ (%)" value={form.notifyLossPct} onChangeText={set('notifyLossPct')} numeric />
      </Card>

      <Button title="Guardar configuración" onPress={save} />
      <Button title="Borrar historial" variant="danger" onPress={clearHistory} />
    </ScrollView>
  );
}

function toForm(s: Settings) {
  return {
    targets: s.pingTargets.map(t => `${t.host}:${t.port}`).join('\n'),
    pingCount: String(s.pingCount),
    backendUrl: s.backendUrl,
    downloadMb: String(s.downloadBytes / MB),
    uploadMb: String(s.uploadBytes / MB),
    sessionIntervalSec: String(s.sessionIntervalSec),
    backgroundIntervalMin: String(s.backgroundIntervalMin),
    notifyRttMs: String(s.notifyRttMs),
    notifyLossPct: String(s.notifyLossPct),
  };
}
