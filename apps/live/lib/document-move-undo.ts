// A document move says what moved and where it went, with an Undo that moves it back
// (docs/specs/004-interface-design/toasts.md "Naming what it acted on"), the same from Change Folder and a drop, in a
// person's own library and within a team's. The Undo closes the toast and runs the caller's move back, which says
// "moved back to" without another Undo.
import { documentMovedMessage, type MoveDestination } from '@/lib/document-toast-copy';
import { toastName } from '@/lib/toast-name';
import type { useToast } from '@/hooks/ui/useToast';

export function offerMoveUndo(
  toast: Pick<ReturnType<typeof useToast>, 'action' | 'dismissAction'>,
  at: { id: string; name: string | null | undefined; dest: MoveDestination; moveBack: () => void },
): void {
  const key = `document-moved:${at.id}`;
  toast.action({
    key,
    message: documentMovedMessage(at.name, at.dest),
    actions: [
      {
        label: 'Undo',
        ariaLabel: `Undo: move ${toastName(at.name) ?? 'the document'} back`,
        onSelect: () => {
          toast.dismissAction(key);
          at.moveBack();
        },
      },
    ],
  });
}
