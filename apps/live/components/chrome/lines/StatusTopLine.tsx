'use client';

import { ActionsGroup } from './ActionsGroup';
import { BrandGroup } from './BrandGroup';

const noop = () => {};

// The top line of a screen with no document in it yet (the new-document wizard, a loading, missing or failed
// document; docs/specs/007-editor/toolbar-layout.md "The two lines"): the brand group's Back and the account control,
// over the screen, in place of the header those screens had. Its parent is the positioned screen.
export function StatusTopLine() {
  return (
    <>
      <BrandGroup explorer={null} />
      <ActionsGroup
        documentActions={false}
        showShare={false}
        shareable={false}
        onOpenShare={noop}
      />
    </>
  );
}
