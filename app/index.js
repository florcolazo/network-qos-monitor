/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import { name as appName } from './app.json';
import { headlessTask } from './src/services/background';

AppRegistry.registerComponent(appName, () => App);

// Muestreo periódico con la app cerrada (Android Headless JS).
BackgroundFetch.registerHeadlessTask(headlessTask);
