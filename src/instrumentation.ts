import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once per server runtime on startup, which is how the
// server/edge Sentry configs get loaded.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown while rendering server components.
export const onRequestError = Sentry.captureRequestError;
