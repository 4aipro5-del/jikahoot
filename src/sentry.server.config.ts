import * as Sentry from "@sentry/nextjs";

// Node runtime init, loaded from instrumentation.ts.
// Very little runs here — the only server components are the two [gameCode]
// pages that await params — but it still catches render/build-time failures.
// SENTRY_DSN is the server-side convention; fall back to the public one, which
// is what the Sentry Vercel integration actually injects.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  // Server-only: attaches local variable values to stack frames, which makes a
  // server render failure diagnosable without reproducing it.
  includeLocalVariables: true,

  enableLogs: true,
});
