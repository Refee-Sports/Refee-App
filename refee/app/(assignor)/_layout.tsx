import { Stack } from "expo-router";

export default function AssignorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tournament/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="tournament/import" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="game/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="conversation/[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
