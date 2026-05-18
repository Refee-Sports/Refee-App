import "../global.css";
import * as WebBrowser from "expo-web-browser";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  InterTight_500Medium,
  InterTight_700Bold,
  InterTight_800ExtraBold,
  InterTight_900Black,
} from "@expo-google-fonts/inter-tight";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { profileExists } from "@/lib/profile/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InterTight_500Medium,
    InterTight_700Bold,
    InterTight_800ExtraBold,
    InterTight_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { profileComplete, setProfileComplete } = useOnboardingStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setProfileComplete(null);
        setAuthReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setProfileComplete(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // When a session is established, check if the user has completed onboarding.
  useEffect(() => {
    if (!session) return;
    profileExists(session.user.id).then((exists) => {
      setProfileComplete(exists);
      setAuthReady(true);
    });
  }, [session?.user.id]);

  const splashReady = fontsLoaded && authReady && (session === null || profileComplete !== null);

  useEffect(() => {
    if (splashReady) SplashScreen.hideAsync();
  }, [splashReady]);

  if (!splashReady) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate session={session} profileComplete={profileComplete}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGate>
    </SafeAreaProvider>
  );
}

/**
 * AuthGate — routes the user to the correct part of the app based on session
 * and whether their public profile has been created.
 * - Not signed in               → /(auth)/welcome
 * - Signed in, no profile       → /(onboarding)
 * - Signed in, profile complete → /(app)
 */
function AuthGate({
  children,
  session,
  profileComplete,
}: {
  children: React.ReactNode;
  session: Session | null;
  profileComplete: boolean | null;
}) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!segments.length) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";

    if (!session) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    // Session exists but profile check not resolved yet — wait.
    if (profileComplete === null) return;

    if (!profileComplete) {
      if (!inOnboardingGroup) router.replace("/(onboarding)");
    } else {
      if (inAuthGroup || inOnboardingGroup) router.replace("/(app)/(tabs)/jobs");
    }
  }, [session, profileComplete, segments]);

  return <>{children}</>;
}
