// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { APPEARANCE_STORAGE_KEY, resetAppearanceForTests } from '@livedoc/ui';
import { AppearanceToggle } from './AppearanceToggle';

// The editor's Appearance control (docs/specs/004-interface-design/appearance.md "The control").

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

let osPrefersDark = false;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  osPrefersDark = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: osPrefersDark && query.includes('dark'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  resetAppearanceForTests();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  track.mockReset();
  vi.restoreAllMocks();
});

const toggle = () => screen.getByRole('button', { name: /^Appearance: / });
const stored = () => localStorage.getItem(APPEARANCE_STORAGE_KEY);
const painted = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

describe('AppearanceToggle', () => {
  it('cycles Light, Dark, System', () => {
    render(<AppearanceToggle />);
    expect(toggle().getAttribute('aria-label')).toBe('Appearance: System. Switch to Light.');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('light');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('dark');
    expect(painted()).toBe('dark');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('system');
    expect(track.mock.calls).toEqual([
      ['UI', 'Toggled', 'Light'],
      ['UI', 'Toggled', 'Dark'],
      ['UI', 'Toggled', 'System'],
    ]);
  });

  it('names the right-click while off System', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light');
    resetAppearanceForTests();
    render(<AppearanceToggle />);
    expect(toggle().getAttribute('aria-label')).toBe(
      'Appearance: Light. Switch to Dark. Right-click to follow your device.',
    );
  });

  it('sets System on right-click, without the browser menu', () => {
    osPrefersDark = true;
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light');
    resetAppearanceForTests();
    render(<AppearanceToggle />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => void toggle().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(stored()).toBe('system');
    expect(painted()).toBe('dark');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'System');
  });

  it('changes nothing on right-click when already on System', () => {
    render(<AppearanceToggle />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => void toggle().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(stored()).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});
