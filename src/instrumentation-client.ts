import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry init. This is where nearly all of JIHOOT's errors surface:
// the app has no API routes or server actions, so auth, Firestore reads/writes,
// grading and the realtime subscriptions all run in the student/teacher browser.
//
// The DSN is public by design (it only identifies the project to ingest into).
// It is supplied by the Sentry Vercel integration in deployed environments; a
// missing DSN simply disables the SDK, which is what we want locally.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  // Full tracing while developing, 10% in production to stay inside quota.
  // Errors are NOT sampled — these rates only affect performance traces.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  integrations: [Sentry.replayIntegration()],

  // Replay is the main payoff for a client-heavy app: it reconstructs what the
  // student actually tapped. Record 10% of ordinary sessions, but keep every
  // session that ended in an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,

  enableLogs: true,

  // `dataCollection` is left at its defaults on purpose — students are minors,
  // so no PII (user info, cookies, headers, request bodies) is sent, and Replay
  // masks text and images out of the box.
});

// Required for Sentry to trace App Router client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
