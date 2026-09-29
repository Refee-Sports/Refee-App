import * as Sentry from "@sentry/react-native";

// Crash reporting. It only turns on when EXPO_PUBLIC_SENTRY_DSN is set (an EAS
// environment variable on the staging / production profiles), so local
// development and builds without a Sentry project behave exactly as before.

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

export const crashReportingEnabled = Boolean(dsn) && environment !== "development";

export function initCrashReporting(): void {
  if (!crashReportingEnabled) return;
  Sentry.init({
    dsn,
    environment,
    // Refee handles phone numbers, IDs and payments: never attach device or
    // user details automatically.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

/** Wraps the root component so render errors are reported; a no-op when disabled. */
export function wrapWithCrashReporting<T extends React.ComponentType<any>>(component: T): T {
  return crashReportingEnabled ? (Sentry.wrap(component) as unknown as T) : component;
}

/** Report a handled error (e.g. a failed payout call) without crashing. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!crashReportingEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
