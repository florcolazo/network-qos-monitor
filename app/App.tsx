import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MapScreen } from './src/screens/MapScreen';
import { MonitorScreen } from './src/screens/MonitorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useQosStore } from './src/store/useQosStore';
import { colors } from './src/ui/theme';

const Tab = createBottomTabNavigator();

const tabIcon = (emoji: string) => () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;

function App() {
  const ready = useQosStore(s => s.ready);

  useEffect(() => {
    useQosStore.getState().init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        {ready ? (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: '#fff',
                tabBarActiveTintColor: colors.primary,
              }}>
              <Tab.Screen name="Monitor" component={MonitorScreen} options={{ tabBarIcon: tabIcon('📶'), title: 'Network QoS Monitor', tabBarLabel: 'Monitor' }} />
              <Tab.Screen name="Mapa" component={MapScreen} options={{ tabBarIcon: tabIcon('🗺️'), title: 'Mapa de cobertura' }} />
              <Tab.Screen name="Historial" component={HistoryScreen} options={{ tabBarIcon: tabIcon('📈') }} />
              <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ tabBarIcon: tabIcon('⚙️') }} />
            </Tab.Navigator>
          </NavigationContainer>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted }}>Solicitando permisos…</Text>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
