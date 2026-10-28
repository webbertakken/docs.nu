// @vitest-environment jsdom

// The centre toolbar says when it takes its own row, and the top corners read it.

import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCentreOwnRow, useReportCentreOwnRow } from './centre-row-store';

afterEach(cleanup);

function Toolbar({ own }: { own: boolean }) {
  useReportCentreOwnRow(own);
  return null;
}

describe('centre row store', () => {
  it('follows the toolbar that reports it, and stands down with it', () => {
    const reader = renderHook(() => useCentreOwnRow());
    expect(reader.result.current).toBe(false);
    const toolbar = render(<Toolbar own />);
    reader.rerender();
    expect(reader.result.current).toBe(true);
    toolbar.rerender(<Toolbar own={false} />);
    reader.rerender();
    expect(reader.result.current).toBe(false);
    toolbar.rerender(<Toolbar own />);
    toolbar.unmount();
    reader.rerender();
    expect(reader.result.current).toBe(false);
  });
});
