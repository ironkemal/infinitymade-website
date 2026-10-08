// Sentry init for the Express backend (calendar-api).
//
// IMPORTANT: This file MUST be the very first import in server.js — Sentry
// auto-instruments libraries (Express, HTTP, postgres) by patching `require`/
// dynamic-import hooks, so anything loaded before Sentry won't be traced.
//
// M4 Logging/Privacy Contract (DSGVO / Fail-Closed Sanitization):
// - sendDefaultPii=false: never collect IP or user-agent automatically.
// - beforeSend & beforeSendTransaction: fail-closed (any failure returns null, dropping the event).
// - Complete removal of content-bearing channels:
//   * request.data, request.headers, request.query_string, request.query, request.cookies
//   * user profile, user id, email, IP
//   * breadcrumbs (dropped completely via beforeBreadcrumb returning null & cleared from event)
//   * extras & contexts (removed completely)
//   * raw exception messages (exc.value replaced with '[REDACTED]')
//   * raw causes and mechanism data (exc.cause and exc.mechanism.data removed)
// - Bounded safe technical stack frames:
//   * preserves only numeric line/column positions and in_app; drops dynamic strings
//   * removes all local variable mappings (frame.vars) and context lines
//   * bounded to max 25 innermost frames

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN_BACKEND || '';
const ENV = process.env.SENTRY_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'test');

const MAX_SAFE_FRAMES = 25;

/**
 * Sanitizes an error event before transmission to Sentry.
 * Fails closed: any error or invalid shape drops the event by returning null.
 *
 * @param {Object} event
 * @param {Object} [_hint]
 * @returns {Object|null}
 */
export function sanitizeEvent(event, _hint) {
  try {
    if (!event || typeof event !== 'object') {
      return null;
    }

    const safeEvent = {};

    if (typeof event.event_id === 'string' && /^[0-9a-f]{32}$/i.test(event.event_id)) {
      safeEvent.event_id = event.event_id;
    }
    if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)) {
      safeEvent.timestamp = event.timestamp;
    }
    const ALLOWED_LEVELS = ['fatal', 'error', 'warning', 'info', 'debug'];
    if (typeof event.level === 'string' && ALLOWED_LEVELS.includes(event.level)) {
      safeEvent.level = event.level;
    }
    if (typeof event.platform === 'string') {
      safeEvent.platform = 'node';
    }

    if (event.exception && Array.isArray(event.exception.values)) {
      const safeExceptionValues = [];
      for (const exc of event.exception.values) {
        if (!exc || typeof exc !== 'object') continue;

        const safeExc = {
          type: 'Error',
          value: '[REDACTED]'
        };

        if (exc.mechanism && typeof exc.mechanism === 'object') {
          safeExc.mechanism = {
            type: 'generic'
          };
        }

        if (exc.stacktrace && Array.isArray(exc.stacktrace.frames)) {
          const rawFrames = exc.stacktrace.frames.slice(-MAX_SAFE_FRAMES);
          safeExc.stacktrace = {
            frames: rawFrames.map((f) => {
              if (!f || typeof f !== 'object') return {};

              let safeFilename = undefined;
              if (typeof f.filename === 'string') {
                safeFilename = f.filename.replace(/[^a-zA-Z0-9_./-]/g, '').slice(-64) || 'unknown';
              }
              let safeFunction = undefined;
              if (typeof f.function === 'string') {
                safeFunction = f.function.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 64) || 'unknown';
              }
              let safeModule = undefined;
              if (typeof f.module === 'string') {
                safeModule = f.module.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64) || 'unknown';
              }

              return {
                filename: undefined,
                function: undefined,
                module: undefined,
                lineno: typeof f.lineno === 'number' && Number.isInteger(f.lineno) ? f.lineno : undefined,
                colno: typeof f.colno === 'number' && Number.isInteger(f.colno) ? f.colno : undefined,
                in_app: typeof f.in_app === 'boolean' ? f.in_app : undefined
              };
            })
          };
        }
        safeExceptionValues.push(safeExc);
      }
      safeEvent.exception = { values: safeExceptionValues };
    }

    return safeEvent;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a transaction event before transmission to Sentry.
 * Fails closed: any error or invalid shape drops the transaction by returning null.
 *
 * @param {Object} event
 * @returns {Object|null}
 */
export function sanitizeTransaction(event) {
  try {
    if (!event || typeof event !== 'object') {
      return null;
    }

    const safeEvent = { type: 'transaction' };

    if (typeof event.event_id === 'string' && /^[0-9a-f]{32}$/i.test(event.event_id)) {
      safeEvent.event_id = event.event_id;
    }
    if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)) {
      safeEvent.timestamp = event.timestamp;
    }
    if (typeof event.start_timestamp === 'number' && Number.isFinite(event.start_timestamp)) {
      safeEvent.start_timestamp = event.start_timestamp;
    }

    if (event.contexts && event.contexts.trace && typeof event.contexts.trace === 'object') {
      const trace = event.contexts.trace;
      const safeTrace = {};
      if (typeof trace.trace_id === 'string' && /^[0-9a-f]{32}$/i.test(trace.trace_id)) {
        safeTrace.trace_id = trace.trace_id;
      }
      if (typeof trace.span_id === 'string' && /^[0-9a-f]{16}$/i.test(trace.span_id)) {
        safeTrace.span_id = trace.span_id;
      }
      safeEvent.contexts = { trace: safeTrace };
    }

    if (typeof event.transaction === 'string') {
        safeEvent.transaction = 'backend';
    }

    if (Array.isArray(event.spans)) {
      const safeSpans = [];
      for (const span of event.spans) {
        if (!span || typeof span !== 'object') continue;
        const safeSpan = {};
        if (typeof span.span_id === 'string' && /^[0-9a-f]{16}$/i.test(span.span_id)) {
          safeSpan.span_id = span.span_id;
        }
        if (typeof span.parent_span_id === 'string' && /^[0-9a-f]{16}$/i.test(span.parent_span_id)) {
          safeSpan.parent_span_id = span.parent_span_id;
        }
        if (typeof span.op === 'string') {
          safeSpan.op = 'backend';
          safeSpan.description = safeSpan.op;
        } else {
          safeSpan.description = '[REDACTED]';
        }

        if (typeof span.start_timestamp === 'number' && Number.isFinite(span.start_timestamp)) {
          safeSpan.start_timestamp = span.start_timestamp;
        }
        if (typeof span.timestamp === 'number' && Number.isFinite(span.timestamp)) {
          safeSpan.timestamp = span.timestamp;
        }

        safeSpans.push(safeSpan);
      }
      safeEvent.spans = safeSpans.slice(-100);
    }

    return safeEvent;
  } catch {
    return null;
  }
}

if (!DSN) {
  console.log('[sentry] SENTRY_DSN_BACKEND not set — error tracking disabled');
} else {
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    serverName: 'calendar-api',

    // Test phase: capture everything. Production: %20 traces sample.
    tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,

    // GDPR: don't auto-collect IP and user-agent
    sendDefaultPii: false,

    // Drop noisy / non-actionable errors.
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'AbortError',
    ],

    beforeSend(event, hint) {
      return sanitizeEvent(event, hint);
    },

    beforeSendTransaction(event) {
      return sanitizeTransaction(event);
    },

    beforeBreadcrumb() {
      // Drop all breadcrumbs before they are recorded
      return null;
    },
  });

  console.log(`[sentry] initialized for ${ENV} (${'calendar-api'})`);
}

export { Sentry };
