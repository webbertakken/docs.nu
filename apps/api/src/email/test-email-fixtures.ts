// Every email the api sends, rendered once with sample arguments, keyed by a readable name. The brand tests
// assert over all of them, the manual live-send harness sends them, and `render-emails.test.ts` writes them to
// disk to look at. A new template joins here, or the brand test cannot see it.

import type { Env } from '../types';
import {
  type RenderedEmail,
  accountDeletedEmail,
  actionAssignedEmail,
  activationEmail,
  commentNotificationEmail,
  documentJoinedEmail,
  firstShareEmail,
  formResponseEmail,
  formSuspendedEmail,
  inviteResponseEmail,
  mentionedEmail,
  milestoneEmail,
  signInCodeEmail,
  teamInviteEmail,
  teamInviteReminderEmail,
  tokenExpiringEmail,
  week1Email,
  week2Email,
  welcomeEmail,
  winBackEmail,
} from './templates';

const form = { heading: 'Event sign-up', documentId: 'doc-123', documentName: 'Q3 Roadmap' };

export function everyEmail(env: Env): Record<string, RenderedEmail> {
  return {
    // Onboarding series
    welcome: welcomeEmail(env),
    'week1-explorer': week1Email(env),
    'week2-teams': week2Email(env),
    activation: activationEmail(env),
    'win-back': winBackEmail(env),
    milestone: milestoneEmail(env, 10),
    'first-share': firstShareEmail(env),
    // Transactional
    'sign-in-code': signInCodeEmail(env, '482913'),
    'team-invite': teamInviteEmail(env, 'Acme Inc', 'decline-token'),
    'team-invite-reminder-1': teamInviteReminderEmail(env, 'Acme Inc', 1, 'decline-token'),
    'team-invite-reminder-2': teamInviteReminderEmail(env, 'Acme Inc', 2, 'decline-token'),
    'team-invite-reminder-3': teamInviteReminderEmail(env, 'Acme Inc', 3, 'decline-token'),
    'account-deleted': accountDeletedEmail(env),
    'token-expiry': tokenExpiringEmail(env, 'CI deploy token', Date.UTC(2026, 0, 5)),
    'form-suspended': formSuspendedEmail(env, form),
    // Opt-out notifications
    'comment-notification': commentNotificationEmail(env, 'Q3 Roadmap', 'doc-123', 'Anna'),
    'document-joined': documentJoinedEmail(env, 'Q3 Roadmap', 'Anna'),
    'invite-accepted': inviteResponseEmail(env, 'Acme Inc', 'sam@example.com', true),
    'invite-declined': inviteResponseEmail(env, 'Acme Inc', 'sam@example.com', false),
    'action-assigned': actionAssignedEmail(
      env,
      'Anna',
      { id: 'doc-123', name: 'Q3 Roadmap' },
      'Draft the launch post',
      'A short post for the blog.',
    ),
    'action-assigned-no-access': actionAssignedEmail(env, 'Anna', null, 'Draft the post', null),
    mentioned: mentionedEmail(env, 'Anna', 'Q3 Roadmap', 'doc-123', '@Sam can you check this?'),
    'form-response': formResponseEmail(env, form, 'Sam Jones', 2),
  };
}
