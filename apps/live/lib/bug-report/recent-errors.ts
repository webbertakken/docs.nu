// The recent client errors a bug report carries (docs/specs/016-platform/bug-reports.md "Context"): a ring buffer of
// the newest five, each redacted before it is kept, mirrored into sessionStorage so the report page a crash links to
// still carries the crash. Installed at boot (ErrorTelemetryBoot); render crashes and failed api requests are recorded
// by their own choke points.
import {
  BUG_REPORT_LIMITS,
  redactErrorText,
  type BugReportErrorSource,
  type BugReportRecentError,
} from '@livedoc/api-schema';

export const RECENT_ERRORS_STORAGE_KEY = 'livedoc:bug-report:recent-errors';

type Options = { storage: Storage | undefined; now?: () => Date };

let buffer: BugReportRecentError[] | null = null;

const defaultStorage = (): Storage | undefined => {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
};

const isRecentError = (v: unknown): v is BugReportRecentError =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as BugReportRecentError).at === 'string' &&
  typeof (v as BugReportRecentError).source === 'string' &&
  typeof (v as BugReportRecentError).message === 'string';

function readStored(storage: Storage | undefined): BugReportRecentError[] {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(RECENT_ERRORS_STORAGE_KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter(isRecentError).slice(-BUG_REPORT_LIMITS.recentErrors)
      : [];
  } catch {
    return [];
  }
}

// Newest last.
export function recentClientErrors(
  storage: Storage | undefined = defaultStorage(),
): BugReportRecentError[] {
  buffer ??= readStored(storage);
  return [...buffer];
}

export function recordClientError(
  source: BugReportErrorSource,
  message: string,
  { storage = defaultStorage(), now = () => new Date() }: Partial<Options> = {},
): void {
  const next = [
    ...recentClientErrors(storage),
    { at: now().toISOString(), source, message: redactErrorText(message) },
  ].slice(-BUG_REPORT_LIMITS.recentErrors);
  buffer = next;
  try {
    storage?.setItem(RECENT_ERRORS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked storage keeps the errors for this page only.
  }
}

// Forgets the page's copy; with a storage, the session's too.
export function clearRecentClientErrors(storage: Storage | undefined): void {
  buffer = null;
  storage?.removeItem(RECENT_ERRORS_STORAGE_KEY);
}

const describeReason = (reason: unknown): string =>
  reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);

// Listens on the window (or `target`) for uncaught errors and unhandled rejections; answers the uninstall.
export function installRecentErrorCapture(
  target: EventTarget,
  options: Partial<Options> = {},
): () => void {
  const onError = (e: Event) =>
    recordClientError('uncaught', (e as ErrorEvent).message || 'Unknown error', options);
  const onRejection = (e: Event) =>
    recordClientError('rejection', describeReason((e as PromiseRejectionEvent).reason), options);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
