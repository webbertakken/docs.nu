'use client';

// Create an account (docs/specs/014-identity/auth-and-guest-access.md "Auth surface"): the same flow as `/sign-in`
// (components/chrome/AuthFlow.tsx) with one name above the email. Lands on the welcome flow (`/new`), unless a safe
// `?redirect_url` says otherwise. Everything made as a guest moves into the account once signed in.

import { Suspense } from 'react';
import { AuthFlow } from '@/components/chrome/AuthFlow';
import { RedirectingCard } from '@/components/chrome/auth-shared';

export default function GetStartedPage() {
  // useSearchParams needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<RedirectingCard />}>
      <AuthFlow kind="sign-up" />
    </Suspense>
  );
}
