import { afterEach, describe, expect, it, vi } from 'vitest';
import { backgroundWaitUntil } from './background';

// docs/specs/015-api/api.md "Background work".

afterEach(() => vi.restoreAllMocks());

describe('backgroundWaitUntil', () => {
  it('logs a failure with the route words and hands the runtime a settled promise', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handed: Promise<unknown>[] = [];
    const waitUntil = backgroundWaitUntil(
      { waitUntil: (p) => handed.push(p) },
      'Post.Teams.Invites',
    );
    const failure = new Error('mail down');
    waitUntil(Promise.reject(failure));
    await expect(handed[0]).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('[background] failed route=Post.Teams.Invites', failure);
  });

  it('lets work that succeeds pass without a line', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handed: Promise<unknown>[] = [];
    backgroundWaitUntil({ waitUntil: (p) => handed.push(p) }, 'Get.Timeline')(Promise.resolve(1));
    await handed[0];
    expect(error).not.toHaveBeenCalled();
  });

  it('still settles the work when there is no execution context', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    backgroundWaitUntil(undefined, 'Get.Timeline')(Promise.reject(new Error('late')));
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        '[background] failed route=Get.Timeline',
        expect.any(Error),
      ),
    );
  });
});
