// The report limit (docs/specs/016-platform/bug-reports.md "Filing" step 1): the binding gates bursts per network
// (its longest period is 60 s), and a D1 fixed window holds five reports per 600 s per visitor. Either missing lets the
// report through, logged: a report is worth more than a perfect count.
import { sha256Hex } from '@livedoc/api-schema';
import { clientIp, clientNetwork } from '../client-ip';
import { claimBugReportSlot } from '../db/bug-reports';
import type { RouteContext } from '../routes/context';

// The binding's period, which is what a throttled burst waits.
const BINDING_PERIOD_SECONDS = 60;

export type RateAnswer = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// `visitor`: the reporter's id, else null for their network.
export async function bugReportRateLimit(
  ctx: RouteContext,
  visitor: string | null,
): Promise<RateAnswer> {
  const { env, request } = ctx;
  const network = clientNetwork(clientIp(request));
  if (env.BUG_REPORT_RATE_LIMITER) {
    const { success } = await env.BUG_REPORT_RATE_LIMITER.limit({ key: `bug-report:${network}` });
    if (!success) {
      console.info('[bug-reports] rate.limited', { by: 'binding' });
      return { allowed: false, retryAfterSeconds: BINDING_PERIOD_SECONDS };
    }
  }
  const key = visitor ? `visitor:${visitor}` : `network:${network}`;
  const hashed = (await sha256Hex(new TextEncoder().encode(key))).slice(0, 32);
  try {
    const answer = await claimBugReportSlot(env, hashed, Date.now());
    if (!answer.allowed) console.info('[bug-reports] rate.limited', { by: 'window' });
    return answer;
  } catch (error) {
    console.warn('[bug-reports] rate.uncounted', { error: String(error) });
    return { allowed: true };
  }
}
