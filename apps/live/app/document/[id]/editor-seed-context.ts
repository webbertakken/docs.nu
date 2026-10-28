import { createContext } from 'react';

// The document the Explorer renders the editor for in its place (InPlaceEditor): its standby, ahead of the click,
// before the address names it. Null everywhere else, where the editor reads its document from the address.
export const EditorSeedIdContext = createContext<string | null>(null);
