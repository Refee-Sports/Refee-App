import { supabase } from "../client";

export type AccountProvider = "phone" | "email" | "google" | "apple";

export type LinkedAccountMethod = {
  id: string;
  provider: AccountProvider;
  label: string;
};

export const PROVIDER_LABEL: Record<AccountProvider, string> = {
  phone: "Phone code",
  email: "Email",
  google: "Google",
  apple: "Apple",
};

function isAccountProvider(value: string): value is AccountProvider {
  return value === "phone" || value === "email" || value === "google" || value === "apple";
}

/** Stable, deduplicated methods for account settings and regression tests. */
export function normalizeAccountMethods(
  identities: Array<{ id: string; provider: string }>,
  fallback: { phone?: string | null } = {}
): LinkedAccountMethod[] {
  const methods = identities
    .filter((identity) => isAccountProvider(identity.provider))
    .map((identity) => ({
      id: identity.id,
      provider: identity.provider as AccountProvider,
      label: PROVIDER_LABEL[identity.provider as AccountProvider],
    }));

  if (fallback.phone && !methods.some((method) => method.provider === "phone")) {
    methods.unshift({ id: "phone", provider: "phone", label: PROVIDER_LABEL.phone });
  }
  return Array.from(new Map(methods.map((method) => [method.provider, method])).values());
}

export async function fetchLinkedAccountMethods(): Promise<{
  methods: LinkedAccountMethod[];
  error: Error | null;
}> {
  const [{ data: identityData, error }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUserIdentities(),
    supabase.auth.getSession(),
  ]);
  if (error) return { methods: [], error: new Error(error.message) };

  const identities = (identityData?.identities ?? []).map((identity) => ({
    id: identity.id,
    provider: identity.provider,
  }));
  const user = sessionData.session?.user;
  return {
    // A phone user is not always represented in identities. Do not infer an
    // email method from user.email: OAuth providers also populate that field.
    methods: normalizeAccountMethods(identities, { phone: user?.phone }),
    error: null,
  };
}

async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // Fall through to the SDK message.
    }
  }
  return error instanceof Error ? error.message : "Could not delete account.";
}

export async function deleteMyAccount(confirmation: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation },
  });
  return { error: error ? new Error(await functionErrorMessage(error)) : null };
}
