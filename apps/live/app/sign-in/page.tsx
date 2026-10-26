'use client';

// Sign in (docs/specs/014-identity/auth-and-guest-access.md "Auth surface"). Never required to use the editor: the
// editor stays open to guests forever; signing in binds this browser's work to an account. The flow is shared with
// `/get-started` (components/chrome/AuthFlow.tsx); an email with no account yet is not turned away, the code creates
// it. Lands on the Explorer, unless a safe `?redirect_url` says otherwise.

import { Suspense } from 'react';
import { AuthFlow } from '@/components/chrome/AuthFlow';
import { RedirectingCard } from '@/components/chrome/auth-shared';

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<RedirectingCard />}>
      <AuthFlow kind="sign-in" />
    </Suspense>
  );
}
