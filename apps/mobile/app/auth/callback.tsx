import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { finalizeOAuthRedirect } from "@/lib/oauth";

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    void finalizeOAuthRedirect(url).then((result) => {
      if (result.error) setError(result.error.message);
    });
  }, [url]);

  return (
    <View className="flex-1 bg-paper items-center justify-center px-8">
      {error ? (
        <>
          <Text className="font-display text-ink text-center" style={{ fontSize: 30 }}>SIGN-IN LINK FAILED</Text>
          <Text className="font-mono text-[10px] text-foul uppercase text-center mt-3" style={{ letterSpacing: 1 }}>{error}</Text>
          <Pressable onPress={() => router.replace("/(auth)/sign-in")} className="bg-ink px-6 py-4 mt-6 active:opacity-75">
            <Text className="font-mono-bold text-[10px] text-paper uppercase" style={{ letterSpacing: 1.5 }}>REQUEST A NEW LINK</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#1F4FCC" />
          <Text className="font-mono-bold text-[10px] text-ink uppercase mt-4" style={{ letterSpacing: 1.5 }}>COMPLETING SIGN IN…</Text>
        </>
      )}
    </View>
  );
}
