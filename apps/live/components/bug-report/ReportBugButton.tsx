'use client';

// The Report a Bug entries (docs/specs/004-interface-design/report-a-bug-entries.md): one control per screen, each in
// its neighbours' style, all opening the one form. Every entry carries `data-bug-report-entry`, so a screenshot
// leaves it out, and names the dialog it opens.
import { BugIcon, Button, HoverCard, type ButtonSize } from '@livedoc/ui';
import { ChromeLabel, useChromeButtonClass } from '@/components/chrome/chrome-button';
import { BUG_REPORT_COPY as COPY } from './bug-report-copy';
import { useOpenBugReport } from './BugReportProvider';

// The chrome controls' icon button (ChromeControls): the editor's actions group, the Explorer's bottom bar, in the
// style of the controls beside it.
export function ReportBugButton({ labelled = false }: { labelled?: boolean }) {
  const open = useOpenBugReport();
  const buttonClass = useChromeButtonClass(labelled);
  return (
    <HoverCard title={COPY.name} description={COPY.entryDescription}>
      <button
        type="button"
        data-bug-report-entry=""
        aria-haspopup="dialog"
        aria-label={COPY.name}
        onClick={(e) => open({ trigger: e.currentTarget })}
        className={buttonClass}
      >
        <BugIcon />
        <ChromeLabel show={labelled}>{COPY.name}</ChromeLabel>
      </button>
    </HoverCard>
  );
}

// An error card's or crash panel's way to report, beside its retry action.
export function ReportBugScreenButton({
  size = 'sm',
  className,
}: {
  size?: ButtonSize;
  className?: string;
}) {
  const open = useOpenBugReport();
  return (
    <Button
      variant="secondary"
      size={size}
      data-bug-report-entry=""
      aria-haspopup="dialog"
      onClick={(e) => open({ trigger: e.currentTarget })}
      {...(className ? { className } : {})}
    >
      {COPY.name}
    </Button>
  );
}
