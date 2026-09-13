import type { PropsWithChildren } from "react";

type PaymentSheetError = {
  code: string;
  message: string;
};

const deviceOnly = async (): Promise<{ error: PaymentSheetError }> => ({
  error: {
    code: "UnsupportedPlatform",
    message: "Stripe PaymentSheet is available in iOS and Android builds, not the web preview.",
  },
});

/** Web keeps the UI testable while making native-only payment behavior explicit. */
export function StripeProvider({ children }: PropsWithChildren<{ publishableKey?: string }>) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: deviceOnly,
    presentPaymentSheet: deviceOnly,
  };
}

