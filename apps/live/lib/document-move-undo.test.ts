import { describe, expect, it, vi } from 'vitest';
import type { ToastActionSpec } from '@/hooks/ui/useToast';
import { offerMoveUndo } from './document-move-undo';

// docs/specs/004-interface-design/toasts.md "Naming what it acted on": a move says what moved and where, with Undo.
describe('offerMoveUndo', () => {
  const toast = () => ({
    action: vi.fn<(spec: ToastActionSpec) => void>(),
    dismissAction: vi.fn(),
  });

  it('names the document and where it went, with one Undo', () => {
    const t = toast();
    offerMoveUndo(t, {
      id: 'd1',
      name: 'Roadmap',
      dest: { folder: 'Plans' },
      moveBack: vi.fn(),
    });
    const offer = t.action.mock.calls[0]![0];
    expect(offer.key).toBe('document-moved:d1');
    expect(offer.message).toBe('“Roadmap” moved to “Plans”');
    expect(offer.actions).toHaveLength(1);
    expect(offer.actions[0]!.label).toBe('Undo');
    expect(offer.actions[0]!.ariaLabel).toBe('Undo: move “Roadmap” back');
  });

  it('closes the toast and moves it back on Undo', () => {
    const t = toast();
    const moveBack = vi.fn();
    offerMoveUndo(t, { id: 'd1', name: null, dest: 'my-documents', moveBack });
    const offer = t.action.mock.calls[0]![0];
    expect(offer.message).toBe('Document moved to My Documents');
    expect(offer.actions[0]!.ariaLabel).toBe('Undo: move the document back');
    offer.actions[0]!.onSelect();
    expect(t.dismissAction).toHaveBeenCalledWith('document-moved:d1');
    expect(moveBack).toHaveBeenCalledOnce();
  });
});
