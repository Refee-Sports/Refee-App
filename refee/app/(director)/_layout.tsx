import { Stack } from "expo-router";

export default function DirectorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tournament/create" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="tournament/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="tournament/import" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="game/create" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="game/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="referee/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="conversation/[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
