// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AVATAR_CLOTHING,
  AVATAR_FIGURES,
  AVATAR_HAIR,
  avatarScale,
  BARE_ARM_CLOTHING,
  BARE_LEG_CLOTHING,
  DEFAULT_AVATAR_CONFIG,
  hasStoredAvatarConfig,
  loadAvatarConfig,
  parseAvatarConfig,
  randomAvatarConfig,
  type AvatarConfig,
} from './avatar-config';

describe('parseAvatarConfig', () => {
  const full: AvatarConfig = {
    figure: 'slender',
    clothing: 'hoodie',
    hair: 'ponytail',
    size: 'tall',
  };

  it('round-trips a complete config, from an object or its JSON', () => {
    expect(parseAvatarConfig(full)).toEqual(full);
    expect(parseAvatarConfig(JSON.stringify(full))).toEqual(full);
  });

  it('falls back to the defaults for nothing stored / unparseable JSON', () => {
    expect(parseAvatarConfig(null)).toEqual(DEFAULT_AVATAR_CONFIG);
    expect(parseAvatarConfig('{not json')).toEqual(DEFAULT_AVATAR_CONFIG);
    expect(parseAvatarConfig(42)).toEqual(DEFAULT_AVATAR_CONFIG);
  });

  it('keeps the fields it recognises and defaults only the ones it does not', () => {
    // A stale option id (retired in a later release) must not cost the whole
    // character — only that one choice.
    const parsed = parseAvatarConfig({ ...full, clothing: 'spacesuit' });
    expect(parsed.clothing).toBe(DEFAULT_AVATAR_CONFIG.clothing);
    expect(parsed.figure).toBe('slender');
    expect(parsed.hair).toBe('ponytail');
    expect(parsed.size).toBe('tall');
  });

  it('defaults missing fields, so a config written by an older build still loads', () => {
    expect(parseAvatarConfig({ figure: 'slender' })).toEqual({
      ...DEFAULT_AVATAR_CONFIG,
      figure: 'slender',
    });
  });
});

describe('avatarScale', () => {
  it('orders small < regular < tall', () => {
    expect(avatarScale('small')).toBeLessThan(avatarScale('regular'));
    expect(avatarScale('regular')).toBeLessThan(avatarScale('tall'));
  });

  it('draws every size ABOVE the base sprite, so even Small reads as a person', () => {
    // The base 40x56 sprite was too small on canvas to see an outfit at all.
    expect(avatarScale('small')).toBeGreaterThan(1);
  });
});

describe('randomAvatarConfig', () => {
  it('only ever rolls values the parser accepts', () => {
    // Guards the catalogues and the roll staying in step: a rolled value that
    // failed to parse would silently reset to the default on the next load.
    for (let i = 0; i < 50; i += 1) {
      const rolled = randomAvatarConfig();
      expect(parseAvatarConfig(rolled)).toEqual(rolled);
    }
  });

  it('leaves size at Regular — it changes how much canvas the character covers', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(randomAvatarConfig().size).toBe('regular');
    }
  });

  it('actually varies, so two first-time visitors are unlikely to match', () => {
    const seen = new Set(
      Array.from({ length: 60 }, () => {
        const c = randomAvatarConfig();
        return `${c.figure}/${c.clothing}/${c.hair}`;
      }),
    );
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('the option catalogues', () => {
  it('offer every clothing and hair token the type allows', () => {
    // The panel renders from these arrays, so a token added to the union but
    // not the catalogue would be unreachable in the UI (and unparseable).
    expect(AVATAR_CLOTHING.map((o) => o.id)).toEqual([
      'tee',
      'stripes',
      'jumper',
      'hoodie',
      'vest',
      'suit',
      'dress',
      'skirt',
      'polo',
      'flannel',
      'overalls',
      'labcoat',
      'hawaiian',
      'varsity',
      'turtleneck',
      'apron',
    ]);
    expect(AVATAR_HAIR.map((o) => o.id)).toEqual([
      'short',
      'buzz',
      'curly',
      'long',
      'ponytail',
      'bun',
      'mohawk',
      'bald',
      'pigtails',
      'afro',
      'spiky',
      'bob',
      'braid',
      'topknot',
    ]);
  });

  it('marks the outfits that change the silhouette', () => {
    expect([...BARE_LEG_CLOTHING].sort()).toEqual(['dress', 'skirt']);
    expect([...BARE_ARM_CLOTHING].sort()).toEqual(['hawaiian', 'vest']);
  });
});

describe('the figure choice', () => {
  it('offers a broad and a slender figure, Broad by default', () => {
    expect(AVATAR_FIGURES).toEqual([
      { id: 'broad', label: 'Broad' },
      { id: 'slender', label: 'Slender' },
    ]);
    expect(DEFAULT_AVATAR_CONFIG.figure).toBe('broad');
  });
});

// docs/specs/008-canvas/avatar-mode.md "Persistence": a character saved before the figure choice existed is read
// once, kept as a figure, and its old key removed, so the old field never stays on the device.
describe('loadAvatarConfig: the character saved before the figure choice', () => {
  const OLD_KEY = 'livediagram:v2:avatar-config';
  const KEY = 'livedoc:v2:avatar-config';
  const saved = (old: Record<string, string>) =>
    window.localStorage.setItem(OLD_KEY, JSON.stringify(old));

  beforeEach(() => window.localStorage.clear());

  it.each([
    ['female', 'slender'],
    ['male', 'broad'],
  ])('keeps a saved %s character as the %s figure', (old, figure) => {
    saved({ gender: old, clothing: 'hoodie', hair: 'bun', size: 'tall' });
    expect(loadAvatarConfig()).toEqual({ figure, clothing: 'hoodie', hair: 'bun', size: 'tall' });
  });

  it('moves it to the new key and removes the old one', () => {
    saved({ gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'tall' });
    loadAvatarConfig();
    expect(window.localStorage.getItem(OLD_KEY)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      figure: 'slender',
      clothing: 'hoodie',
      hair: 'bun',
      size: 'tall',
    });
    expect(window.localStorage.getItem(KEY)).not.toContain('gender');
  });

  it('counts as a stored character, so the first use does not roll a new one', () => {
    saved({ gender: 'male' });
    expect(hasStoredAvatarConfig()).toBe(true);
  });

  it('prefers the current key and drops a stale old one', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_AVATAR_CONFIG, hair: 'afro' }));
    saved({ gender: 'female' });
    expect(loadAvatarConfig()).toEqual({ ...DEFAULT_AVATAR_CONFIG, hair: 'afro' });
    expect(window.localStorage.getItem(OLD_KEY)).toBeNull();
  });

  it('defaults the figure when the old value is unrecognised', () => {
    saved({ gender: 'robot', hair: 'afro' });
    expect(loadAvatarConfig()).toEqual({ ...DEFAULT_AVATAR_CONFIG, hair: 'afro' });
  });
});
