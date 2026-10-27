'use client';

// Jump Back In (docs/specs/013-workspace/explorer-home.md "Jump Back In"): the person's Within reach
// set of documents. On a desktop or tablet a grid of thumbnails, four across: Most Used then Recent, each group under
// its small label and each tile with its quiet line,
// with See More in the heading row; on a phone the alternating strip that ends in its See More tile, which
// interleaves the groups and so labels neither. Each document carries its Explorer ⋯ menu when the Explorer has it,
// and a document that leaves the Explorer's lists (moved to the Trash, taken off Shared With Me) leaves at once.

import { useId, useMemo } from 'react';
import { CompactEmptyState, useMediaQuery } from '@livedoc/ui';
import { track } from '@/lib/telemetry';
import { useRelativeNow } from '@/lib/relative-time';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import {
  jumpBackInLine,
  type JumpBackInGroup,
  type JumpBackInSet,
} from '@/app/explorer/home/home-model';
import type { DocumentEntryFor } from '@/app/explorer/useDocumentEntryFor';
import { HomeSection } from './HomeSection';
import { GridSkeleton, StripSkeleton } from './HomeSkeletons';
import { JumpBackInStrip } from './JumpBackInStrip';
import { JumpBackInTile } from './JumpBackInTile';
import type { JumpBackInMenuFor } from './JumpBackInMenu';
import { EMPTY_SLOT, GRID, GRID_THUMB, GROUP_LABEL, JUMP_BACK_IN_MIN_HEIGHT } from './home-styles';
import { JumpBackInEmptyIcon } from './home-icons';

/** The grid from the spec's `md:` up: desktop and tablet. */
const HOME_WIDE_QUERY = '(min-width: 768px)';

const HEADING_ID = 'home-jump-back-in';

const GROUP_LABELS: Record<JumpBackInGroup, string> = { mostUsed: 'Most Used', recent: 'Recent' };

export function JumpBackIn({
  ownerId,
  set: fullSet,
  loading,
  recentHref,
  onSeeMore,
  documentMenus,
}: {
  ownerId: string;
  set: JumpBackInSet;
  loading: boolean;
  /** The Recent page, for See More's href (new tab, copy link). */
  recentHref: string;
  /** In-app navigation to the Recent page. */
  onSeeMore: () => void;
  /** The Explorer's document menus (useDocumentEntryFor); omitted outside the Explorer, no card has one. */
  documentMenus?: DocumentEntryFor;
}) {
  const wide = useMediaQuery(HOME_WIDE_QUERY);
  const set = useMemo(() => {
    if (!documentMenus) return fullSet;
    const here = (item: JumpBackInSet['mostUsed'][number]) =>
      !documentMenus.isGone(item.documentId);
    return { mostUsed: fullSet.mostUsed.filter(here), recent: fullSet.recent.filter(here) };
  }, [fullSet, documentMenus]);
  const menuFor = documentMenus?.entryFor;
  const empty = set.mostUsed.length === 0 && set.recent.length === 0;
  return (
    <HomeSection
      id="jump-back-in"
      title={HOME_COPY.jumpBackIn}
      busy={loading}
      // See More only once there is something to see more of (explorer-home.md "Jump Back In").
      link={
        wide && !loading && !empty
          ? {
              href: recentHref,
              label: HOME_COPY.seeMore,
              onNavigate: onSeeMore,
              onActivate: () => track('Home', 'Selected', 'JumpBackIn.SeeMore'),
            }
          : undefined
      }
    >
      {!wide ? (
        loading ? (
          <StripSkeleton />
        ) : (
          <JumpBackInStrip
            ownerId={ownerId}
            set={set}
            recentHref={recentHref}
            onSeeMore={onSeeMore}
            labelledBy={HEADING_ID}
            menuFor={menuFor}
          />
        )
      ) : loading ? (
        <GridSkeleton />
      ) : empty ? (
        // The shared empty state (docs/specs/004-interface-design/empty-states.md) in place of one tile's thumbnail and
        // words, so an empty Jump Back In looks like a list with one thing in it.
        <div className={GRID}>
          <div className={`col-span-2 h-[7.25rem] ${EMPTY_SLOT}`}>
            <CompactEmptyState
              className="h-full w-full"
              icon={<JumpBackInEmptyIcon />}
              title={HOME_COPY.jumpBackInEmptyTitle}
              description={HOME_COPY.jumpBackInEmpty}
            />
          </div>
        </div>
      ) : (
        <div className={`flex flex-col gap-4 ${JUMP_BACK_IN_MIN_HEIGHT}`}>
          <CardGroup ownerId={ownerId} group="mostUsed" items={set.mostUsed} menuFor={menuFor} />
          <CardGroup ownerId={ownerId} group="recent" items={set.recent} menuFor={menuFor} />
        </div>
      )}
    </HomeSection>
  );
}

/** One labelled group of tiles; a group with no document draws nothing, label included. */
function CardGroup({
  ownerId,
  group,
  items,
  menuFor,
}: {
  ownerId: string;
  group: JumpBackInGroup;
  items: JumpBackInSet['mostUsed'];
  menuFor?: JumpBackInMenuFor;
}) {
  const labelId = useId();
  const now = useRelativeNow();
  if (items.length === 0) return null;
  return (
    <div data-jump-back-in-group={group}>
      <h3 id={labelId} className={GROUP_LABEL}>
        {GROUP_LABELS[group]}
      </h3>
      <ul aria-labelledby={labelId} className={GRID}>
        {items.map((item) => (
          <li key={item.documentId} className="min-w-0">
            <JumpBackInTile
              ownerId={ownerId}
              item={item}
              group={group}
              thumbClassName={GRID_THUMB}
              line={jumpBackInLine(item, group, now)}
              entry={menuFor?.(item.documentId) ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
