import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeSendTransaction } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  beforeSend,
  beforeSendTransaction,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
