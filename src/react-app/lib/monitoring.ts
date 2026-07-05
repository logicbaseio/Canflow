import * as Sentry from "@sentry/react";

/**
 * Initialise error monitoring. No-ops unless VITE_SENTRY_DSN is set, so local
 * dev and preview builds stay silent while production reports crashes.
 */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture unhandled errors + a light sample of performance traces.
    tracesSampleRate: 0.1,
    // Only send events we can act on; drop noisy browser-extension frames.
    ignoreErrors: ["ResizeObserver loop limit exceeded", "Non-Error promise rejection captured"],
  });
}

export { Sentry };
