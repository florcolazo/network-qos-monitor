module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Requerido por react-native-reanimated (dependencia de victory-native). Debe ir último.
  plugins: ['react-native-worklets/plugin'],
};
