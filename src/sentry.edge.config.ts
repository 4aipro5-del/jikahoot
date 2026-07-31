import * as Sentry from "@sentry/nextjs";

// Edge runtime init, loaded from instrumentation.ts.
// Currently unused (no middleware or edge routes) — kept so that adding one
// later is instrumented automatically rather than silently unmonitored.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  enableLogs: true,
});
