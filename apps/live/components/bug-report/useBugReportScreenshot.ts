'use client';

// The screenshot a report carries (docs/specs/016-platform/bug-reports.md "The form"): none until asked, then one
// captured, chosen, pasted or dropped, replacing what was attached; previewed before sending, and removable. A capture
// that is still running can be waited on, so Send never sends an earlier picture or none by mistake.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureScreen,
  encodeImageFile,
  type PreparedScreenshot,
} from '@/lib/bug-report/screenshot';
import { BUG_REPORT_COPY } from './bug-report-copy';

export type BugReportScreenshotState = {
  prepared: PreparedScreenshot | null;
  capturing: boolean;
  error: string | null;
  // Polite announcement of what just happened ("Screenshot added.").
  announcement: string;
  capture: () => void;
  attachFile: (file: Blob) => void;
  remove: () => void;
  // The attached screenshot once any running capture or encoding has ended.
  settled: () => Promise<PreparedScreenshot | null>;
};

export function useBugReportScreenshot(): BugReportScreenshotState {
  const [prepared, setPrepared] = useState<PreparedScreenshot | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const running = useRef<Promise<PreparedScreenshot | null> | null>(null);
  const latest = useRef<PreparedScreenshot | null>(null);

  const replace = useCallback((next: PreparedScreenshot | null) => {
    if (latest.current) URL.revokeObjectURL(latest.current.previewUrl);
    latest.current = next;
    setPrepared(next);
  }, []);

  // The preview's object URL goes with the form.
  useEffect(
    () => () => {
      if (latest.current) URL.revokeObjectURL(latest.current.previewUrl);
    },
    [],
  );

  const run = useCallback(
    (work: () => Promise<PreparedScreenshot | null>, failure: string) => {
      if (running.current) return;
      setCapturing(true);
      setError(null);
      setAnnouncement('');
      const job = work().then((next) => {
        running.current = null;
        setCapturing(false);
        if (next) {
          replace(next);
          setAnnouncement(BUG_REPORT_COPY.screenshotAdded);
        } else {
          setError(failure);
        }
        return next ?? latest.current;
      });
      running.current = job;
    },
    [replace],
  );

  return {
    prepared,
    capturing,
    error,
    announcement,
    capture: useCallback(() => run(captureScreen, BUG_REPORT_COPY.captureFailed), [run]),
    attachFile: useCallback(
      (file: Blob) => run(() => encodeImageFile(file), BUG_REPORT_COPY.imageRefused),
      [run],
    ),
    remove: useCallback(() => {
      replace(null);
      setError(null);
      setAnnouncement('');
    }, [replace]),
    settled: useCallback(async () => (running.current ? running.current : latest.current), []),
  };
}
