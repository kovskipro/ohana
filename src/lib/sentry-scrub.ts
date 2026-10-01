import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";
import type { TransactionEvent } from "@sentry/core";

const SENSITIVE_KEY = /pesel|password|hasł|hasl|token|secret|authoriz|auth_|session|cookie|birth|urodz|address|adres|street|ulic|house|numer|telefon|phone|email|mail|nazwisko|imie|firstname|lastname/i;

const PII_PATTERNS: RegExp[] = [
  /\b\d{11}\b/g,
  /\b\d{2}\.\d{2}\.\d{4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /[+\w][\w.+%-]*@[\w.-]+\.[A-Za-z]{2,}/g,
  /(?:\+48[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/g,
];

const REDACTED = "[REDACTED]";

function redactString(value: string): string {
  let out = value;
  for (const pattern of PII_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" && Number.isInteger(value) && value >= 10000000000 && value <= 99999999999) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function scrubEvent(event: ErrorEvent | TransactionEvent): ErrorEvent | TransactionEvent {
  if (event.request) {
    const request = { ...event.request };
    delete request.data;
    delete request.headers;
    delete request.cookies;
    if (request.query_string && typeof request.query_string === "string") {
      request.query_string = redactString(request.query_string);
    }
    event.request = request;
  }

  if (event.user) {
    const user = { ...event.user };
    delete user.email;
    delete user.username;
    delete user.ip_address;
    delete user.geo;
    event.user = user;
  }

  if (event.message) {
    event.message = redactString(event.message);
  }

  if (event.extra) {
    event.extra = redactValue(event.extra) as typeof event.extra;
  }

  if (event.contexts) {
    event.contexts = redactValue(event.contexts) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb): Breadcrumb => {
      const next: Breadcrumb = {
        ...breadcrumb,
        message: breadcrumb.message ? redactString(breadcrumb.message) : breadcrumb.message,
      };
      if (breadcrumb.data) {
        next.data = redactValue(breadcrumb.data) as Record<string, unknown>;
      }
      return next;
    });
  }

  return event;
}

export function beforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  return scrubEvent(event) as ErrorEvent;
}

export function beforeSendTransaction(event: TransactionEvent, _hint?: EventHint): TransactionEvent | null {
  return scrubEvent(event) as TransactionEvent;
}
