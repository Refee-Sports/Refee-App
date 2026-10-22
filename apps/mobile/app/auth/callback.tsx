import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { finalizeOAuthRedirect } from "@/lib/oauth";
import { palette } from "@refee/design";
import { Button } from "@/components/ui/Button";

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
          <Text className="font-mono text-[10px] text-foul-ink uppercase text-center mt-3" style={{ letterSpacing: 1 }}>{error}</Text>
          <View className="mt-6">
            <Button label="Request a new link" onPress={() => router.replace("/(auth)/sign-in")} />
          </View>
        </>
      ) : (
        <>
          <ActivityIndicator color={palette.signal} />
          <Text className="font-mono-bold text-[10px] text-ink uppercase mt-4" style={{ letterSpacing: 1.5 }}>COMPLETING SIGN IN…</Text>
        </>
      )}
    </View>
  );
}
