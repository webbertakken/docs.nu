'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

// The site's front door (docs/specs/001-project-vision/purpose.md "The product comes first",
// docs/specs/013-workspace/explorer-home.md "Route"): `/` lands on Explorer Home. In production the live
// worker 302s this path before any HTML is served (src/worker.ts); this client replace is the
// dev-server / direct-asset fallback, and keeps the query string as the worker does.
export default function FrontDoor() {
  // Full page loads once a newer build is live (docs/specs/016-platform/stale-builds.md).
  const router = useAppNavigation();
  useEffect(() => {
    router.replace(`${EXPLORER_LANDING_PATH}${window.location.search}`);
  }, [router]);
  return null;
}
