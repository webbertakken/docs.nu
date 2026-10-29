'use client';

// Jump Back In (docs/specs/013-workspace/explorer-home.md "Jump Back In"): the person's Within reach
// set of documents. On a desktop or tablet a 4 by 2 grid of thumbnails, most used on top and recent below, each tile
// its thumbnail and name, with See More in the heading row; on a phone the alternating strip that ends in its See More
// tile. The two halves carry no titles: the documents are one list named Jump Back In (Calm by default). Each document carries its Explorer ⋯ menu when the Explorer has it,
// and a document that leaves the Explorer's lists (moved to the Trash, taken off Shared With Me) leaves at once.

import { useMemo } from 'react';
import { CompactEmptyState, useMediaQuery } from '@livedoc/ui';
import { track } from '@/lib/telemetry';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import type {
  JumpBackInGroup,
  JumpBackInItem,
  JumpBackInSet,
} from '@/app/explorer/home/home-model';
import type { DocumentEntryFor } from '@/app/explorer/useDocumentEntryFor';
import { HomeSection } from './HomeSection';
import { GridSkeleton, StripSkeleton } from './HomeSkeletons';
import { JumpBackInStrip } from './JumpBackInStrip';
import { JumpBackInTile } from './JumpBackInTile';
import type { JumpBackInMenuFor } from './JumpBackInMenu';
import { EMPTY_SLOT, GRID, GRID_MIN_HEIGHT, GRID_THUMB } from './home-styles';
import { JumpBackInEmptyIcon } from './home-icons';

/** The grid from the spec's `md:` up: desktop and tablet. */
const HOME_WIDE_QUERY = '(min-width: 768px)';

const HEADING_ID = 'home-jump-back-in';

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
          <div className={`col-span-2 h-[6.25rem] ${EMPTY_SLOT}`}>
            <CompactEmptyState
              className="h-full w-full"
              icon={<JumpBackInEmptyIcon />}
              title={HOME_COPY.jumpBackInEmptyTitle}
              description={HOME_COPY.jumpBackInEmpty}
            />
          </div>
        </div>
      ) : (
        <ul aria-labelledby={HEADING_ID} className={`${GRID} ${GRID_MIN_HEIGHT}`}>
          {set.mostUsed.map((item) => (
            <GridTile
              key={item.documentId}
              ownerId={ownerId}
              item={item}
              group="mostUsed"
              menuFor={menuFor}
            />
          ))}
          {set.recent.map((item, i) => (
            <GridTile
              key={item.documentId}
              ownerId={ownerId}
              item={item}
              group="recent"
              menuFor={menuFor}
              // The recent open the second row, whatever the length of the first.
              startsRow={i === 0 && set.mostUsed.length > 0}
            />
          ))}
        </ul>
      )}
    </HomeSection>
  );
}

/** One document of the grid; `startsRow` puts it in the first column, opening a new row. */
function GridTile({
  ownerId,
  item,
  group,
  menuFor,
  startsRow = false,
}: {
  ownerId: string;
  item: JumpBackInItem;
  group: JumpBackInGroup;
  menuFor?: JumpBackInMenuFor;
  startsRow?: boolean;
}) {
  return (
    <li className={`min-w-0 ${startsRow ? 'col-start-1' : ''}`}>
      <JumpBackInTile
        ownerId={ownerId}
        item={item}
        group={group}
        thumbClassName={GRID_THUMB}
        entry={menuFor?.(item.documentId) ?? null}
      />
    </li>
  );
}
