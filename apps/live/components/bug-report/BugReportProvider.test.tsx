// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/016-platform/bug-reports.md "Entries": every entry opens the one form, names the dialog it opens, and
// gets focus back when the form closes.

const tracked: unknown[][] = [];
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => tracked.push(args) }));
vi.mock('./BugReportDialog', () => ({
  BugReportDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Report a Bug">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const { BugReportProvider, useOpenBugReport } = await import('./BugReportProvider');
const { ReportBugButton, ReportBugScreenButton } = await import('./ReportBugButton');

afterEach(() => {
  cleanup();
  tracked.length = 0;
});

describe('Report a Bug entries', () => {
  it.each([
    ['the bottom bar button', <ReportBugButton key="b" />],
    ['an error card button', <ReportBugScreenButton key="s" />],
  ])('%s opens the form, counts it, and takes focus back on close', async (_label, entry) => {
    render(<BugReportProvider>{entry}</BugReportProvider>);
    const button = screen.getByRole('button', { name: 'Report a Bug' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.hasAttribute('data-bug-report-entry')).toBe(true);
    fireEvent.click(button);
    await screen.findByRole('dialog', { name: 'Report a Bug' });
    expect(tracked).toEqual([['Feedback', 'Opened', 'Bug']]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('runs the opener’s onClosed once the form closes', async () => {
    const onClosed = vi.fn();
    function Opener() {
      const open = useOpenBugReport();
      return (
        <button type="button" onClick={() => open({ onClosed })}>
          Open
        </button>
      );
    }
    render(
      <BugReportProvider>
        <Opener />
      </BugReportProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
  });

  it('sends an entry outside the provider to the form page', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    function Outside() {
      const open = useOpenBugReport();
      return (
        <button type="button" onClick={() => open()}>
          Open
        </button>
      );
    }
    render(<Outside />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(assign).toHaveBeenCalledWith('/report-a-bug');
    vi.unstubAllGlobals();
  });
});
