// Web text scaling is controlled by the browser and react-native-web. The
// native implementation patches React Native internals and must never bundle
// on web.
export function applyGlobalFontScaleCap() {
  // Intentionally a no-op on web.
}

