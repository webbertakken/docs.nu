// What the Appearance boot path needs (docs/specs/004-interface-design/appearance.md): the
// localStorage key, the OS media query and the pre-paint script, in a PLAIN module,
// deliberately NOT `'use client'`. Every app's root layout is a server component and
// inlines the script; a constant defined in a client module reaches the server as a
// client-reference stub whose text holds an apostrophe, which once broke the quoted
// key and threw on every page load, so dark mode never applied before paint.

import { CHROME_SURFACE_ATTRIBUTE, CHROME_SURFACES } from './chrome-colour';

const { header: H, ground: G } = CHROME_SURFACES;
//
// The key still SAYS ui-mode: it is stored data, not vocabulary. Renaming it would
// silently reset the preference for everyone who has ever set it.
export const APPEARANCE_STORAGE_KEY = 'livedoc:v2:ui-mode';

// The OS-level dark preference, read by the store at runtime and by the pre-paint
// script. Shared so the two cannot disagree about what System means.
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

// Runs before first paint in every app. 'dark' paints dark, 'light' stays light, and
// anything else (System, nothing stored, a value this build does not know) defers to
// the device, because System is the default. It then points the theme-color meta at the page's top, the header or
// the ground as the layout declares (chrome-colour.ts), so an installed app's title bar is right from the first
// frame; a themed tab or Midnight refines it once mounted. Each half is wrapped in try/catch: an exception here (storage denied) would take the rest
// of the inline boot with it, and denied storage still paints the light chrome.
export const APPEARANCE_BOOT_SCRIPT = `var d=false;try{var s=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');d=s==='dark'||(s!=='light'&&typeof matchMedia==='function'&&matchMedia('${DARK_MEDIA_QUERY}').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}try{var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}var g=document.documentElement.getAttribute('${CHROME_SURFACE_ATTRIBUTE}')==='ground';m.content=d?(g?'${G.dark}':'${H.dark}'):(g?'${G.light}':'${H.light}')}catch(e){}`;
