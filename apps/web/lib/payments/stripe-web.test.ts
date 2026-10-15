import { afterEach, describe, expect, it, vi } from "vitest";

const loadStripe = vi.hoisted(() => vi.fn(async () => ({ id: "stripe" })));
vi.mock("@stripe/stripe-js", () => ({ loadStripe }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  loadStripe.mockClear();
});

describe("getStripe", () => {
  it("is null, and loads nothing, without a publishable key", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
    const { getStripe, isStripeConfigured } = await import("./stripe-web");
    expect(isStripeConfigured).toBe(false);
    expect(await getStripe()).toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it("loads Stripe.js once with the key", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    const { getStripe, isStripeConfigured } = await import("./stripe-web");
    expect(isStripeConfigured).toBe(true);
    await getStripe();
    await getStripe();
    expect(loadStripe).toHaveBeenCalledTimes(1);
    expect(loadStripe).toHaveBeenCalledWith("pk_test_123");
  });
});
