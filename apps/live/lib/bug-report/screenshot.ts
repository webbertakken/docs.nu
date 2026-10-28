// A bug report's screenshot (docs/specs/016-platform/bug-reports.md "The form"): the page behind the form captured,
// or an image the reporter chose, scaled so its longer side is at most 1,600 px and encoded as WebP (JPEG where WebP is
// unavailable), the quality stepped down until it fits 1 MB. The capture library loads only on the first capture.
import {
  BUG_REPORT_LIMITS,
  bytesToBase64,
  type BugReportScreenshot,
  type BugReportScreenshotType,
} from '@livedoc/api-schema';

// Blueprint D14: from 0.9 down to 0.4 in steps of 0.1.
export const SCREENSHOT_QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] as const;

// How long a capture waits for the page's pictures, at most: a lazy picture below the fold never loads.
const CAPTURE_MEDIA_TIMEOUT_MS = 1000;

// What a capture leaves out: the form itself and every entry (they carry these attributes).
export const BUG_REPORT_CHROME_SELECTOR = '[data-bug-report-dialog], [data-bug-report-entry]';

// The form (with its dimmed backdrop, the panel's parent) and every entry: never in the picture.
export function isBugReportChrome(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  if (node.matches(BUG_REPORT_CHROME_SELECTOR)) return true;
  return Boolean(
    node.firstElementChild?.matches('[data-dialog-panel]') &&
    node.querySelector('[data-bug-report-dialog]'),
  );
}

export const ACCEPTED_SCREENSHOT_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

export type PreparedScreenshot = { screenshot: BugReportScreenshot; previewUrl: string };

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// The first quality whose encoding fits `maxBytes`, or null.
export async function encodeToFit(
  encode: (quality: number) => Promise<Blob | null>,
  maxBytes: number,
): Promise<Blob | null> {
  for (const quality of SCREENSHOT_QUALITY_STEPS) {
    const blob = await encode(quality);
    if (!blob) return null;
    if (blob.size <= maxBytes) return blob;
  }
  return null;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// A canvas, any size, as the screenshot to send: scaled, encoded and fitted; null when it cannot be.
export async function encodeCanvas(source: HTMLCanvasElement): Promise<PreparedScreenshot | null> {
  const { width, height } = fitWithin(
    source.width,
    source.height,
    BUG_REPORT_LIMITS.screenshotSide,
  );
  if (width === 0 || height === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.drawImage(source, 0, 0, width, height);
  // A browser that cannot encode WebP hands back a PNG instead; JPEG is the fallback then.
  const probe = await toBlob(canvas, 'image/webp', 0.9);
  const type: BugReportScreenshotType = probe?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await encodeToFit((q) => toBlob(canvas, type, q), BUG_REPORT_LIMITS.screenshotBytes);
  if (!blob) return null;
  const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  return { screenshot: { contentType: type, data }, previewUrl: URL.createObjectURL(blob) };
}

// A chosen, pasted or dropped image file; null when it cannot be decoded or fitted.
export async function encodeImageFile(file: Blob): Promise<PreparedScreenshot | null> {
  if (!ACCEPTED_SCREENSHOT_TYPES.includes(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await encodeCanvas(canvas);
  } catch (error) {
    console.warn('[bug-reports] image.refused', { error: String(error) });
    return null;
  }
}

// The page as the reporter sees it, without the form and the entries; null when the capture fails.
export async function captureScreen(): Promise<PreparedScreenshot | null> {
  try {
    const { domToCanvas } = await import('modern-screenshot');
    const canvas = await domToCanvas(document.documentElement, {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: Math.min(
        1,
        BUG_REPORT_LIMITS.screenshotSide / Math.max(window.innerWidth, window.innerHeight),
      ),
      timeout: CAPTURE_MEDIA_TIMEOUT_MS,
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
      filter: (node) => !isBugReportChrome(node),
    });
    return await encodeCanvas(canvas);
  } catch (error) {
    console.warn('[bug-reports] capture.failed', { error: String(error) });
    return null;
  }
}
