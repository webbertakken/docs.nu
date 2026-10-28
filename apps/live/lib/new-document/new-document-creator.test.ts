import { describe, expect, it } from 'vitest';
import { bindNewDocumentCreator, newDocumentCreator } from './new-document-creator';

describe('the new document creator', () => {
  it('is whoever the Explorer bound last, until it unbinds', () => {
    expect(newDocumentCreator()).toBeNull();
    const pat = { ownerId: 'pat', signedIn: true };
    const unbindPat = bindNewDocumentCreator(pat);
    expect(newDocumentCreator()).toBe(pat);
    const guest = { ownerId: 'guest', signedIn: false };
    const unbindGuest = bindNewDocumentCreator(guest);
    // An older binding going does not unbind the newer one.
    unbindPat();
    expect(newDocumentCreator()).toBe(guest);
    unbindGuest();
    expect(newDocumentCreator()).toBeNull();
  });
});
