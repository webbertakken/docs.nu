// Element tours' kinds, gate and answers (docs/specs/007-editor/element-tours.md "Remembering answers", "Share roles").

import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedoc/document';
import {
  answerEveryElementTour,
  canTourElement,
  ELEMENT_TOUR_KINDS,
  elementTourKindOf,
  elementTourSeen,
  markElementTourSeen,
  offerElementTourAgain,
  offerEveryElementTour,
} from './element-tours';

const sankey = createShape('sankey', 0, 0) as Element;

describe('element tours', () => {
  it('tours a Sankey and nothing else yet', () => {
    expect(elementTourKindOf(sankey)).toBe('sankey');
    expect(elementTourKindOf(createShape('square', 0, 0) as Element)).toBeNull();
    expect(elementTourKindOf(null)).toBeNull();
  });

  it('offers it only to whoever may edit the element', () => {
    expect(canTourElement({ level: 'edit' }, sankey, 'sankey')).toBe(true);
    expect(canTourElement({ level: 'participate' }, sankey, 'sankey')).toBe(false);
    expect(canTourElement({ level: 'view' }, sankey, 'sankey')).toBe(false);
    expect(canTourElement({ level: 'edit' }, { ...sankey, locked: true }, 'sankey')).toBe(false);
  });

  it('offers no kind until the person opts in', () => {
    expect(elementTourSeen({}, 'sankey')).toBe(true);
    expect(elementTourSeen(null, 'sankey')).toBe(true);
    expect(elementTourSeen({ elementTourOffers: ['sankey'] }, 'sankey')).toBe(false);
    expect(elementTourSeen({ elementTourOffers: ['sankey'] }, 'flowchart')).toBe(true);
  });

  it('remembers an answer, and counts every kind seen for a power user only', () => {
    const optedIn = { elementTourOffers: ['sankey' as const] };
    expect(elementTourSeen(optedIn, 'sankey')).toBe(false);
    expect(elementTourSeen(markElementTourSeen(optedIn, 'sankey'), 'sankey')).toBe(true);
    expect(elementTourSeen({ ...optedIn, elementToursSeen: true }, 'sankey')).toBe(false);
    expect(
      elementTourSeen({ ...optedIn, elementToursSeen: true, powerUserMode: true }, 'sankey'),
    ).toBe(true);
  });

  it('marks an answer once', () => {
    const once = markElementTourSeen({}, 'sankey');
    expect(markElementTourSeen(once, 'sankey')).toEqual({ elementTourKinds: ['sankey'] });
  });

  it('opts a kind in when its switch is turned on, and no other', () => {
    const on = offerElementTourAgain({}, 'flowchart');
    expect(on).toEqual({
      elementToursSeen: false,
      elementTourOffers: ['flowchart'],
      elementTourKinds: [],
    });
    expect(elementTourSeen(on, 'flowchart')).toBe(false);
    expect(elementTourSeen(on, 'sankey')).toBe(true);
  });

  it('offers a kind again, even to a power user', () => {
    const power = {
      powerUserMode: true,
      elementToursSeen: true,
      elementTourOffers: ['sankey' as const],
      elementTourKinds: ['sankey' as const],
    };
    const again = offerElementTourAgain(power, 'sankey');
    expect(elementTourSeen(again, 'sankey')).toBe(false);
    expect(again.elementToursSeen).toBe(false);
  });

  it('keeps a power user’s other opted-in kinds answered when one is offered again', () => {
    const power = {
      powerUserMode: true,
      elementToursSeen: true,
      elementTourOffers: ['sankey' as const, 'chart' as const],
    };
    const again = offerElementTourAgain(power, 'sankey');
    expect(elementTourSeen(again, 'chart')).toBe(true);
    expect(again.elementTourKinds).toEqual(['chart']);
  });

  it('opts every kind in at once, forgetting every answer', () => {
    const all = offerEveryElementTour({ elementTourKinds: ['sankey'], elementToursSeen: true });
    expect(all.elementTourOffers).toEqual([...ELEMENT_TOUR_KINDS]);
    expect(all.elementTourKinds).toBeUndefined();
    expect(all.elementToursSeen).toBe(false);
    expect(ELEMENT_TOUR_KINDS.every((k) => !elementTourSeen(all, k))).toBe(true);
  });

  it('answers every kind at once, keeping who opted in', () => {
    const none = answerEveryElementTour({ elementTourOffers: ['sankey'] });
    expect(none.elementTourOffers).toEqual(['sankey']);
    expect(none.elementTourKinds).toEqual([...ELEMENT_TOUR_KINDS]);
    expect(none.elementToursSeen).toBe(true);
    expect(elementTourSeen(none, 'sankey')).toBe(true);
  });
});

describe('element tour kinds of the concept graphics', () => {
  it('tours a pyramid and an inverted one as the Pyramid, never a funnel', () => {
    const pyramid = createShape('pyramid', 0, 0) as Element;
    expect(elementTourKindOf(pyramid)).toBe('pyramid');
    expect(elementTourKindOf({ ...pyramid, pyramidVariant: 'inverted' } as Element)).toBe(
      'pyramid',
    );
    expect(elementTourKindOf({ ...pyramid, pyramidVariant: 'funnel' } as Element)).not.toBe(
      'pyramid',
    );
    expect(canTourElement({ level: 'edit' }, pyramid, 'pyramid')).toBe(true);
    expect(canTourElement({ level: 'participate' }, pyramid, 'pyramid')).toBe(false);
  });
});

describe('the Funnel element tour kind', () => {
  it('tours a pyramid in its Funnel variant as the Funnel', () => {
    const funnel = { ...createShape('pyramid', 0, 0), pyramidVariant: 'funnel' } as Element;
    expect(elementTourKindOf(funnel)).toBe('funnel');
    expect(canTourElement({ level: 'edit' }, funnel, 'funnel')).toBe(true);
    expect(canTourElement({ level: 'view' }, funnel, 'funnel')).toBe(false);
  });
});

describe('the Cycle element tour kind', () => {
  it('tours a cycle, for an Editor only', () => {
    const cycle = createShape('cycle', 0, 0) as Element;
    expect(elementTourKindOf(cycle)).toBe('cycle');
    expect(canTourElement({ level: 'edit' }, cycle, 'cycle')).toBe(true);
    expect(canTourElement({ level: 'participate' }, cycle, 'cycle')).toBe(false);
  });
});

describe('the Hub and Spoke element tour kind', () => {
  it('tours a hub, for an Editor only', () => {
    const hub = createShape('hub', 0, 0) as Element;
    expect(elementTourKindOf(hub)).toBe('hub');
    expect(canTourElement({ level: 'edit' }, hub, 'hub')).toBe(true);
    expect(canTourElement({ level: 'view' }, hub, 'hub')).toBe(false);
  });
});

describe('the Onion element tour kind', () => {
  it('tours an onion, for an Editor only', () => {
    const onion = createShape('onion', 0, 0) as Element;
    expect(elementTourKindOf(onion)).toBe('onion');
    expect(canTourElement({ level: 'edit' }, onion, 'onion')).toBe(true);
    expect(canTourElement({ level: 'participate' }, onion, 'onion')).toBe(false);
  });
});

describe('the Chevrons element tour kind', () => {
  it('tours a chevron process, for an Editor only', () => {
    const chevrons = createShape('chevrons', 0, 0) as Element;
    expect(elementTourKindOf(chevrons)).toBe('chevrons');
    expect(canTourElement({ level: 'edit' }, chevrons, 'chevrons')).toBe(true);
    expect(canTourElement({ level: 'participate' }, chevrons, 'chevrons')).toBe(false);
  });
});

describe('the Mind Map element tour kind', () => {
  it('tours a mind node, but not a person node (an org chart), for an Editor only', () => {
    const node = createShape('mind-node', 0, 0) as Element;
    expect(elementTourKindOf(node)).toBe('mind-node');
    expect(elementTourKindOf({ ...node, mindLook: 'person' } as Element)).not.toBe('mind-node');
    expect(canTourElement({ level: 'edit' }, node, 'mind-node')).toBe(true);
    expect(canTourElement({ level: 'participate' }, node, 'mind-node')).toBe(false);
    expect(canTourElement({ level: 'edit' }, { ...node, locked: true }, 'mind-node')).toBe(false);
  });
});

describe('the Flowchart element tour kind', () => {
  it('tours a flowchart step, never a plain shape of the same kind', () => {
    const square = createShape('square', 0, 0) as Element;
    const step = { ...square, flowchartId: 'f1' } as Element;
    expect(elementTourKindOf(step)).toBe('flowchart');
    expect(elementTourKindOf(square)).toBeNull();
    expect(canTourElement({ level: 'edit' }, step, 'flowchart')).toBe(true);
    expect(canTourElement({ level: 'participate' }, step, 'flowchart')).toBe(false);
  });
});

describe('the Org Chart element tour kind', () => {
  it('tours a person node as the org chart, for an Editor only', () => {
    const person = { ...createShape('mind-node', 0, 0), mindLook: 'person' } as Element;
    expect(elementTourKindOf(person)).toBe('org-chart');
    expect(canTourElement({ level: 'edit' }, person, 'org-chart')).toBe(true);
    expect(canTourElement({ level: 'participate' }, person, 'org-chart')).toBe(false);
  });
});

describe('the Sequence element tour kind', () => {
  it('tours a sequence diagram, for an Editor on an unlocked one', () => {
    const seq = createShape('sequence', 0, 0) as Element;
    expect(elementTourKindOf(seq)).toBe('sequence');
    expect(canTourElement({ level: 'edit' }, seq, 'sequence')).toBe(true);
    expect(canTourElement({ level: 'participate' }, seq, 'sequence')).toBe(false);
    expect(canTourElement({ level: 'edit' }, { ...seq, locked: true }, 'sequence')).toBe(false);
  });
});
