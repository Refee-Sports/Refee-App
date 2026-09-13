"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe-web";

type Props = {
  clientSecret: string;
  title: string;
  /** Summary lines shown above the card form, e.g. crew total + platform fee. */
  summary?: { label: string; value: string }[];
  submitLabel: string;
  /** "payment" confirms a PaymentIntent; "setup" saves a card for auto-pay. */
  mode: "payment" | "setup";
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
};

/**
 * The web stand-in for the app's Stripe PaymentSheet. Same client secret, same
 * edge functions — only the card UI differs, because PaymentSheet is native.
 */
export function StripePaymentModal(props: Props) {
  if (!isStripeConfigured) {
    return (
      <Backdrop onCancel={props.onCancel}>
        <div className="border-[1.5px] border-ink bg-paper p-5">
          <p
            className="font-mono-bold text-[10px] uppercase text-foul"
            style={{ letterSpacing: 2 }}
          >
            Stripe not configured
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-80">
            Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to the same publishable key
            the mobile app uses, then reload.
          </p>
          <button
            type="button"
            onClick={props.onCancel}
            className="mt-5 w-full border border-ink py-3 font-mono-bold text-[11px] uppercase text-ink hover:bg-ink hover:text-paper"
            style={{ letterSpacing: 2 }}
          >
            Close
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onCancel={props.onCancel}>
      <Elements
        stripe={getStripe()}
        options={{
          clientSecret: props.clientSecret,
          appearance: {
            theme: "flat",
            variables: {
              colorPrimary: "#1F4FCC",
              colorBackground: "#F5F2EA",
              colorText: "#08111C",
              borderRadius: "0px",
              fontFamily: "ui-monospace, monospace",
            },
          },
        }}
      >
        <PaymentForm {...props} />
      </Elements>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onCancel,
}: {
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PaymentForm({
  title,
  summary,
  submitLabel,
  mode,
  onCancel,
  onSuccess,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    // redirect: "if_required" keeps the flow in-page for card payments, the
    // same as the native sheet; only redirect-based methods leave the page.
    const result =
      mode === "payment"
        ? await stripe.confirmPayment({ elements, redirect: "if_required" })
        : await stripe.confirmSetup({ elements, redirect: "if_required" });

    if (result.error) {
      setError(result.error.message ?? "Payment failed.");
      setBusy(false);
      return;
    }

    await onSuccess();
    setBusy(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t-2 border-ink bg-paper">
      <div className="flex items-center justify-between border-b border-ink-20 px-5 py-3">
        <span
          className="font-mono-bold text-[10px] uppercase text-ink"
          style={{ letterSpacing: 2 }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center border border-ink bg-chalk text-ink"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {summary && summary.length > 0 ? (
        <div className="border-b border-ink-20 px-5 py-3">
          {summary.map((row) => (
            <div key={row.label} className="flex justify-between py-1">
              <span
                className="font-mono text-[10px] uppercase text-ink-60"
                style={{ letterSpacing: 1.5 }}
              >
                {row.label}
              </span>
              <span
                className="font-mono-bold text-[11px] uppercase text-ink"
                style={{ letterSpacing: 1 }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="px-5 py-4">
        <PaymentElement />
        {error ? (
          <p
            className="mt-3 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="action-bar">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="flex w-full items-center justify-center gap-2 bg-ink py-4 text-paper hover:opacity-80 disabled:opacity-40"
        >
          {busy ? (
            <Spinner />
          ) : (
            <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
              {submitLabel}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
