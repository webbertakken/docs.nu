// The icon catalogue types now live in @livedoc/icons (shared with the
// Workers' headless renders); re-exported here so the app's existing
// `@/lib/icon-types` import sites keep resolving unchanged.

export type { IconDef, IconPrim } from '@livedoc/icons';
