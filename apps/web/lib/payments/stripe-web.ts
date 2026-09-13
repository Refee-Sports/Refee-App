import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Web Stripe.js loader. The mobile app uses @stripe/stripe-react-native's
 * PaymentSheet; on the web the same client secrets (from the same pay-crew /
 * setup-payment-method edge functions) are confirmed with Stripe Elements.
 *
 * Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to the same publishable key the app
 * uses (EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY).
 */
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null);
  stripePromise ??= loadStripe(publishableKey);
  return stripePromise;
}

export const isStripeConfigured = !!publishableKey;
