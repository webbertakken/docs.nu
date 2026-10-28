// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanCardsClusterStrip } from './PlanCardsClusterStrip';

// docs/specs/026-plan/items.md "The Plan strip": each button is its icon alone on every width, as the cluster's other
// strips are (docs/specs/007-editor/live-app.md "The cluster names nothing"), named by its label and hover card.
const plan = {
  draggingItemId: null as string | null,
  canEdit: true,
  types: [{ id: 'task' }] as unknown[],
  items: new Map([['a', { id: 'a', fields: { status: 'trash' } }]]) as Map<string, unknown>,
};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

const strip = () =>
  render(
    <PlanCardsClusterStrip
      finderOpen={false}
      onToggleFinder={() => {}}
      typesOpen={false}
      onToggleTypes={() => {}}
      trash={{ open: false, onToggle: () => {} }}
      newCard={{ open: false, onToggle: () => {} }}
    />,
  );

describe('the Plan strip’s buttons', () => {
  it('shows icons alone on the widest desktop, in order, each with its fuller label', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    strip();
    // Only the Trash's count, tucked into its corner.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '', '', '']);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Open the Trash, 1 card',
      expect.any(String),
      expect.any(String),
      'Open Card Types',
    ]);
    expect(
      screen.getByRole('button', { name: /Open the Trash/ }).querySelector('.absolute'),
    ).toBeTruthy();
  });
});
