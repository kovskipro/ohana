import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/404",
          destination: "/nie-znaleziono",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withSentryConfig(nextConfig, {
  org: "ohana-2m",
  project: "ohana",
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
