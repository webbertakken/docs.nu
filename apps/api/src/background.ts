// Background work a route hands off with `waitUntil` (docs/specs/015-api/api.md "Background work"): it runs after
// the answer has gone, so nothing would see it fail. One catch, attached here, logs every failure with the route's
// words, so a handler hands its work over as it is and never needs a catch of its own.

type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };

export function backgroundWaitUntil(
  executionCtx: ExecutionContextLike | undefined,
  route: string,
): (promise: Promise<unknown>) => void {
  return (promise) => {
    const logged = promise.then(
      () => undefined,
      (err: unknown) => console.error(`[background] failed route=${route}`, err),
    );
    executionCtx?.waitUntil(logged);
  };
}
