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
import Constants from "expo-constants";
import { StripeProvider } from "@/lib/payments/stripe";
import { supabase } from "@/lib/supabase";
import { ensureValidSession } from "@/lib/auth/session";
import { Session } from "@supabase/supabase-js";
import { profileExists, fetchPrimaryRole } from "@/lib/profile/queries";
import { useOnboardingStore, type PrimaryRole } from "@/lib/stores/onboarding-store";
import { registerForPushNotifications } from "@/lib/push/notifications";
import { applyGlobalFontScaleCap } from "@/lib/ui/text-scaling";
import { LogBox } from "react-native";

// Bound OS Dynamic Type scaling app-wide so text stays scalable (accessibility)
// without breaking the dense layouts. Runs once at module load.
applyGlobalFontScaleCap();

// Dev-only: hide LogBox warning/error toasts so they don't cover the UI. No-op in prod.
LogBox.ignoreAllLogs();

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
  const { profileComplete, setProfileComplete, setPrimaryRole } = useOnboardingStore();

  useEffect(() => {
    (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (initialSession) {
        const valid = await ensureValidSession();
        if (!valid) {
          setSession(null);
          setProfileComplete(null);
          setPrimaryRole(null);
          setAuthReady(true);
          return;
        }
      }

      setSession(initialSession);
      if (!initialSession) {
        setProfileComplete(null);
        setPrimaryRole(null);
        setAuthReady(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfileComplete(null);
        setPrimaryRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setPrimaryRole, setProfileComplete]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const exists = await profileExists(session.user.id);
      setProfileComplete(exists);
      if (exists) {
        const role = await fetchPrimaryRole(session.user.id);
        setPrimaryRole(role as PrimaryRole);
        // Register for push once the profile exists (no-op on Expo Go/simulator)
        void registerForPushNotifications(session.user.id);
      }
      setAuthReady(true);
    })();
  }, [session, setPrimaryRole, setProfileComplete]);

  const { primaryRole } = useOnboardingStore();

  const splashReady =
    fontsLoaded &&
    authReady &&
    (session === null ||
      profileComplete !== true ||
      primaryRole !== null);

  useEffect(() => {
    if (splashReady) SplashScreen.hideAsync();
  }, [splashReady]);

  if (!splashReady) return null;

  return (
    <SafeAreaProvider>
      <StripeProvider
        publishableKey={
          (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ??
          process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
          ""
        }
        merchantIdentifier="merchant.app.refee"
      >
        <StatusBar style="dark" />
        <AuthGate session={session} profileComplete={profileComplete} primaryRole={primaryRole}>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="(director)" />
            <Stack.Screen name="(assignor)" />
            <Stack.Screen name="auth/callback" />
            {/* Belongs to every role, so AuthGate leaves it alone. */}
            <Stack.Screen name="verify" />
          </Stack>
        </AuthGate>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

function AuthGate({
  children,
  session,
  profileComplete,
  primaryRole,
}: {
  children: React.ReactNode;
  session: Session | null;
  profileComplete: boolean | null;
  primaryRole: PrimaryRole | null;
}) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!segments.length) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const inAppGroup = segments[0] === "(app)";
    const inDirectorGroup = (segments[0] as string) === "(director)";
    const inAssignorGroup = (segments[0] as string) === "(assignor)";
    const inAuthCallback = (segments[0] as string) === "auth";

    if (!session) {
      if (!inAuthGroup && !inAuthCallback) router.replace("/(auth)/welcome");
      return;
    }

    // Wait until both profile and role are resolved
    if (profileComplete === null) return;

    if (!profileComplete) {
      if (!inOnboardingGroup) router.replace("/(onboarding)/role-select" as any);
      return;
    }

    // Profile exists — wait until role is also fetched
    if (primaryRole === null) return;

    if (primaryRole === "director") {
      if (inAuthGroup || inOnboardingGroup || inAppGroup || inAssignorGroup) {
        router.replace("/(director)/(tabs)/tournaments" as any);
      }
    } else if (primaryRole === "assignor") {
      if (inAuthGroup || inOnboardingGroup || inAppGroup || inDirectorGroup) {
        router.replace("/(assignor)/(tabs)/tournaments" as any);
      }
    } else {
      if (inAuthGroup || inOnboardingGroup || inDirectorGroup || inAssignorGroup) {
        router.replace("/(app)/(tabs)/jobs");
      }
    }
  }, [session, profileComplete, primaryRole, segments, router]);

  return <>{children}</>;
}
