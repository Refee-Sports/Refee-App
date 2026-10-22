import { Linking, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";

// Set these once the listings exist (EAS environment variables for the
// production profile). Until then the buttons fall back to a store search.
const IOS_STORE_URL =
  process.env.EXPO_PUBLIC_IOS_STORE_URL ?? "https://apps.apple.com/search?term=Refee";
const ANDROID_STORE_URL =
  process.env.EXPO_PUBLIC_ANDROID_STORE_URL ?? "market://details?id=com.refee.app";

/** Shown instead of the app when this install is older than the backend supports. */
export function UpdateRequired() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-paper px-6 justify-center"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Wordmark size={30} />
      <Text className="text-ink font-display mt-10" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.5 }}>
        TIME TO{"\n"}
        <Text className="text-signal">UPDATE.</Text>
      </Text>
      <Text className="text-ink-80 mt-4" style={{ fontSize: 15, lineHeight: 22 }}>
        This version of Refee is out of date and can no longer connect. Update to the latest version to keep
        taking games, chatting with your crew and getting paid.
      </Text>
      <View className="mt-8">
        <Button
          label="Update Refee"
          fullWidth
          onPress={() => void Linking.openURL(Platform.OS === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL)}
        />
      </View>
    </View>
  );
}
