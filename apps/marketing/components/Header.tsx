import type { CtaSurface } from '@livedoc/api-schema';
import { SiteHeader } from '@livedoc/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), which the
// telemetry dashboard and the help centre render too. `surface` is the page's landing-funnel surface (docs/specs/019-marketing/landing-funnel.md),
// which the header's CTA pair carries into the editor. Every marketing page shows the Build with AI link
// (docs/specs/019-marketing/build-with-ai.md), marked current on /ai itself.
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return <SiteHeader ctaSurface={surface} buildWithAi={surface === 'Ai' ? 'current' : 'link'} />;
}
