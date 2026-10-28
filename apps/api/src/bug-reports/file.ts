// Filing a bug report from the worker (docs/specs/016-platform/bug-reports.md "Filing" step 5): the configured Bug
// Tracker, checked in D1 before its room is asked (so an unknown id never wakes a room), then the room's write. Every
// way it can fail is a reason to store the report, never an error the reporter sees.
import { findBugReportType, type BugReportFiling } from '@livedoc/api-schema';
import { typesOf } from '@livedoc/items';
import { getDocument } from '../db';
import { documentRoom } from '../document-room/document-client';
import type { Env } from '../types';
import type { BugReportFileOutcome } from './room-file';

export async function fileBugReport(
  env: Env,
  filing: BugReportFiling,
): Promise<BugReportFileOutcome> {
  const documentId = env.BUG_REPORT_DOCUMENT_ID;
  const tabId = env.BUG_REPORT_TAB_ID;
  if (!documentId || !tabId) return { filed: false, reason: 'unconfigured' };
  const doc = await getDocument(env, documentId);
  if (!doc) return { filed: false, reason: 'document_missing' };
  if (!findBugReportType(typesOf(doc.itemTypes))) return { filed: false, reason: 'type_missing' };
  try {
    return await documentRoom(env, documentId).fileBugReport(tabId, filing);
  } catch (error) {
    console.error('[bug-reports] room.failed', { error: String(error) });
    return { filed: false, reason: 'room_unavailable' };
  }
}
