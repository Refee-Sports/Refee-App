import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { CryptoDigestAlgorithm, CryptoEncoding } from "expo-crypto";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

/** Deep link back into the app after OAuth (add same URLs in Supabase → Authentication → URL Configuration). */
export function getOAuthRedirectUri(): string {
  return makeRedirectUri({
    scheme: "refee",
    path: "auth/callback",
  });
}

function extractOAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hashIdx = url.indexOf("#");
  if (hashIdx >= 0) {
    new URLSearchParams(url.slice(hashIdx + 1)).forEach((v, k) => {
      out[k] = v;
    });
  }
  const qIdx = url.indexOf("?");
  if (qIdx >= 0 && (hashIdx < 0 || qIdx < hashIdx)) {
    const queryOnly = url.slice(qIdx + 1).split("#")[0];
    new URLSearchParams(queryOnly).forEach((v, k) => {
      out[k] = v;
    });
  }
  return out;
}

export async function finalizeOAuthRedirect(url: string): Promise<{ error: Error | null }> {
  const params = extractOAuthParams(url);
  if (params.error) {
    const desc = params.error_description ?? params.error;
    return { error: new Error(desc) };
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: error ? new Error(error.message) : null };
  }
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error ? new Error(error.message) : null };
  }
  return { error: new Error("Could not complete sign-in from redirect.") };
}

async function startOAuthBrowser(provider: "google" | "apple"): Promise<{ error: Error | null }> {
  const redirectTo = getOAuthRedirectUri();
  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (oauthError) return { error: new Error(oauthError.message) };
  if (!data.url) return { error: new Error("No OAuth URL returned from Supabase.") };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { error: null };
  }
  if (result.type !== "success" || !("url" in result) || !result.url) {
    return { error: new Error("Sign-in was not completed.") };
  }

  return finalizeOAuthRedirect(result.url);
}

async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: CryptoEncoding.HEX }
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const token = credential.identityToken;
    if (!token) {
      return { error: new Error("Apple did not return an identity token.") };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token,
      nonce: rawNonce,
    });
    return { error: error ? new Error(error.message) : null };
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "ERR_REQUEST_CANCELED") {
      return { error: null };
    }
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Google — OAuth web flow (works on iOS and Android). */
export async function signInWithGoogleOAuth(): Promise<{ error: Error | null }> {
  try {
    return await startOAuthBrowser("google");
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Apple — native Sign in with Apple on iOS when available; otherwise OAuth web flow (e.g. Android).
 */
export async function signInWithAppleOAuth(): Promise<{ error: Error | null }> {
  if (Platform.OS === "ios") {
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      return signInWithAppleNative();
    }
  }
  try {
    return await startOAuthBrowser("apple");
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
