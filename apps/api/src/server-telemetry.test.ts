import { afterEach, describe, expect, it, vi } from 'vitest';

const { insertTelemetryEvents } = vi.hoisted(() => ({ insertTelemetryEvents: vi.fn() }));
vi.mock('./db/telemetry', () => ({ insertTelemetryEvents }));

import { reportServerEvent } from './server-telemetry';
import type { Env } from './types';

// docs/specs/015-api/api.md "Background work": best-effort writes say so.

const env = { TELEMETRY_ENABLED: 'true' } as Env;
afterEach(() => vi.restoreAllMocks());

describe('reportServerEvent', () => {
  it('logs a row that failed to land, and still resolves', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('D1 down');
    insertTelemetryEvents.mockRejectedValueOnce(failure);
    await expect(reportServerEvent(env, 'Document', 'Joined', 'Editor')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      '[telemetry] server event failed category=Document action=Joined',
      failure,
    );
  });

  it('writes nothing when telemetry is off', async () => {
    await reportServerEvent({} as Env, 'Document', 'Joined');
    expect(insertTelemetryEvents).not.toHaveBeenCalled();
  });
});
