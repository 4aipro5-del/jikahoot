import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Next.js configuration for the JIHOOT app.

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

// Sentry wraps the config to upload source maps at build time — without them a
// stack trace only points at minified bundle output. The env vars are injected
// by the Sentry Vercel integration and take precedence; the literals keep local
// production builds working too. `authToken` is the one real secret here, and
// its absence only skips the upload — the build still succeeds.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "indi-ud",
  project: process.env.SENTRY_PROJECT ?? "jihoot",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only chatter in CI logs, stay quiet during local builds.
  silent: !process.env.CI,

  // Broadens source map upload so stack traces resolve inside shared chunks too.
  widenClientFileUpload: true,

  // Routes Sentry requests through our own domain. School networks commonly run
  // ad blockers and content filters that would otherwise drop them.
  tunnelRoute: "/sentry-tunnel",
});
