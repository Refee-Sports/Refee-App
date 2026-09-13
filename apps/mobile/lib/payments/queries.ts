import { supabase } from "@/lib/supabase";

// Thin wrappers around the Stripe edge functions. All money logic lives
// server-side; the app only presents the payment sheet / onboarding link.

/**
 * supabase.functions.invoke returns a generic "non-2xx status code" message on
 * error; the real message lives in the response body (error.context). Pull it
 * out so the UI shows what actually went wrong.
 */
async function invokeErrorMessage(error: any): Promise<string> {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    }
    if (ctx && typeof ctx.text === "function") {
      const t = await ctx.text();
      if (t) return t;
    }
  } catch {
    /* fall through to generic message */
  }
  return error?.message ?? "Request failed";
}

export type PayCrewQuote = {
  clientSecret: string;
  crewTotal: number;
  platformFee: number;
  total: number;
  refCount: number;
};

export async function startCrewPayment(
  jobId: string
): Promise<{ quote: PayCrewQuote | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("pay-crew", {
    body: { jobId },
  });
  if (error) return { quote: null, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { quote: null, error: new Error(data.error) };
  return { quote: data as PayCrewQuote, error: null };
}

export async function confirmCrewPayout(
  jobId: string
): Promise<{ transferred: number; held: number; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("confirm-payout", {
    body: { jobId },
  });
  if (error) return { transferred: 0, held: 0, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { transferred: 0, held: 0, error: new Error(data.error) };
  return { transferred: data.transferred ?? 0, held: data.held ?? 0, error: null };
}

export async function getPayoutOnboardingLink(
  returnUrl: string
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("connect-onboard", {
    body: { returnUrl, refreshUrl: returnUrl },
  });
  if (error) return { url: null, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { url: null, error: new Error(data.error) };
  return { url: data.url as string, error: null };
}

export type PayoutStatus = {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  /** held payouts released on this check */
  released: number;
};

export async function fetchPayoutStatus(): Promise<{
  status: PayoutStatus;
  error: Error | null;
}> {
  const fallback: PayoutStatus = { hasAccount: false, payoutsEnabled: false, released: 0 };
  const { data, error } = await supabase.functions.invoke("connect-status", { body: {} });
  if (error) return { status: fallback, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { status: fallback, error: new Error(data.error) };
  return {
    status: {
      hasAccount: !!data.hasAccount,
      payoutsEnabled: !!data.payoutsEnabled,
      released: data.released ?? 0,
    },
    error: null,
  };
}

// ── Card on file + auto-pay ──────────────────────────────────────────────────

export type SetupSheetParams = {
  setupIntentClientSecret: string;
  customerId: string;
  ephemeralKeySecret: string;
};

export async function getCardSetupParams(): Promise<{
  params: SetupSheetParams | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.functions.invoke("setup-payment-method", { body: {} });
  if (error) return { params: null, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { params: null, error: new Error(data.error) };
  return { params: data as SetupSheetParams, error: null };
}

export type AutoPayResult = {
  paid: Array<{ jobId: string; title: string; total: number; transferred: number; held: number }>;
  skipped: Array<{ jobId: string; title: string; reason: string }>;
  /** "no_card" when the director hasn't saved a payment method */
  reason: string | null;
};

export async function runAutoPay(
  jobId?: string
): Promise<{ result: AutoPayResult | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("auto-pay", {
    body: jobId ? { jobId } : {},
  });
  if (error) return { result: null, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { result: null, error: new Error(data.error) };
  return { result: data as AutoPayResult, error: null };
}
