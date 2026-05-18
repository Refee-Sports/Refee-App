module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Reanimated must be last (expo-router is handled by babel-preset-expo in SDK 50+)
      "react-native-reanimated/plugin",
    ],
  };
};
