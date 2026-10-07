import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';

const CHANNEL_ID = 'qos-alerts';

export async function setupNotifications(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Alertas de calidad de red',
    importance: AndroidImportance.HIGH,
  });
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

/** Notificación local ante una degradación severa de la red (RF-07). */
export async function notifyDegradation(reason: string, detail: string): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Alertas de calidad de red',
    importance: AndroidImportance.HIGH,
  });
  await notifee.displayNotification({
    id: 'qos-degradation', // reemplaza la anterior en lugar de acumular
    title: `Red degradada: ${reason}`,
    body: detail,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
}
