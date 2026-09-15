import { describe, it, expect } from 'vitest';
import { DESIGN, fitToScreen, layOutRow, visibleBounds } from './layout.js';
import { PARK, PARK_SCALE, SCENE, platformAnchor } from './geometry.js';
import { ANIMAL_ART } from './animals-art.js';
import { ANIMAL_IDS } from '../logic/animals.js';
import { groupOffsets, traySlots } from './hud.js';

describe('fitToScreen', () => {
  it('scales to fit a wide screen and letterboxes the sides', () => {
    const screen = { width: DESIGN.width * 2, height: DESIGN.height };
    const transform = fitToScreen(screen);
    expect(transform.scale).toBeCloseTo(1);
    expect(transform.offsetX).toBeCloseTo(DESIGN.width / 2);
    expect(transform.offsetY).toBeCloseTo(0);
  });

  it('scales to fit a tall screen and letterboxes top and bottom', () => {
    const screen = { width: DESIGN.width, height: DESIGN.height * 2 };
    const transform = fitToScreen(screen);
    expect(transform.scale).toBeCloseTo(1);
    expect(transform.offsetY).toBeCloseTo(DESIGN.height / 2);
    expect(transform.offsetX).toBeCloseTo(0);
  });

  it('maps design points into screen space', () => {
    const screen = { width: DESIGN.width * 2, height: DESIGN.height * 2 };
    const transform = fitToScreen(screen);
    expect(transform.scale).toBeCloseTo(2);
    expect(transform.toScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(transform.toScreen({ x: DESIGN.width, y: DESIGN.height })).toEqual({
      x: screen.width,
      y: screen.height,
    });
  });

  it('maps screen points back to design space', () => {
    const transform = fitToScreen({ width: DESIGN.width * 2, height: DESIGN.height * 2 });
    expect(transform.toDesign({ x: DESIGN.width, y: DESIGN.height })).toEqual({
      x: DESIGN.width / 2,
      y: DESIGN.height / 2,
    });
  });

  it('survives a zero-sized screen', () => {
    const transform = fitToScreen({ width: 0, height: 0 });
    expect(Number.isFinite(transform.scale)).toBe(true);
  });
});

describe('visibleBounds', () => {
  it('matches the design rect when the shapes agree', () => {
    const screen = { width: DESIGN.width, height: DESIGN.height };
    const bounds = visibleBounds(screen, fitToScreen(screen));
    expect(bounds).toEqual({ left: 0, top: 0, right: DESIGN.width, bottom: DESIGN.height });
  });

  it('extends sideways on a wide screen, so nothing is left to letterbox', () => {
    const screen = { width: DESIGN.width * 2, height: DESIGN.height };
    const bounds = visibleBounds(screen, fitToScreen(screen));
    expect(bounds.left).toBeLessThan(0);
    expect(bounds.right).toBeGreaterThan(DESIGN.width);
    expect(bounds.top).toBeCloseTo(0);
    expect(bounds.bottom).toBeCloseTo(DESIGN.height);
  });

  it('extends vertically on a tall screen', () => {
    const screen = { width: DESIGN.width, height: DESIGN.height * 2 };
    const bounds = visibleBounds(screen, fitToScreen(screen));
    expect(bounds.top).toBeLessThan(0);
    expect(bounds.bottom).toBeGreaterThan(DESIGN.height);
  });

  it('always contains the design rect, whatever the screen', () => {
    for (const screen of [
      { width: 1180, height: 820 },
      { width: 1366, height: 1024 },
      { width: 1133, height: 744 },
      { width: 744, height: 1133 },
    ]) {
      const bounds = visibleBounds(screen, fitToScreen(screen));
      expect(bounds.left).toBeLessThanOrEqual(0.001);
      expect(bounds.top).toBeLessThanOrEqual(0.001);
      expect(bounds.right).toBeGreaterThanOrEqual(DESIGN.width - 0.001);
      expect(bounds.bottom).toBeGreaterThanOrEqual(DESIGN.height - 0.001);
    }
  });
});

describe('layOutRow', () => {
  const same = (count: number, width: number) => new Array(count).fill(width);

  it('draws a lone animal as big as it is allowed to be', () => {
    expect(layOutRow(same(1, 120), 212, 1.08).scale).toBe(1.08);
  });

  it('centres the row, for one through five', () => {
    for (let count = 1; count <= 5; count += 1) {
      const { offsets } = layOutRow(same(count, 120), 212, 1.08);
      expect(offsets).toHaveLength(count);
      expect(offsets[0]! + offsets[count - 1]!).toBeCloseTo(0);
    }
  });

  it('keeps every animal inside the basket, whatever is standing in it', () => {
    for (let count = 1; count <= 5; count += 1) {
      for (const species of ANIMAL_IDS) {
        const width = ANIMAL_ART[species].height * ANIMAL_ART[species].aspect;
        const { scale, offsets } = layOutRow(same(count, width), SCENE.basketInner, 1.08);
        for (const offset of offsets) {
          expect(Math.abs(offset) + (width * scale) / 2).toBeLessThanOrEqual(SCENE.basketInner / 2 + 0.5);
        }
      }
    }
  });

  it('shrinks a crowd rather than letting it spill out', () => {
    const one = layOutRow(same(1, 200), 212, 1.08).scale;
    const four = layOutRow(same(4, 200), 212, 1.08).scale;
    expect(four).toBeLessThan(one);
  });

  it('gives a heavy armful less room than a light one', () => {
    const bears = layOutRow(same(2, 203), 212, 1.08).scale;
    const chicks = layOutRow(same(2, 101), 212, 1.08).scale;
    expect(bears).toBeLessThan(chicks);
  });

  it('keeps them in order, left to right', () => {
    const { offsets } = layOutRow([101, 203, 123], 212, 1.08);
    expect(offsets[0]!).toBeLessThan(offsets[1]!);
    expect(offsets[1]!).toBeLessThan(offsets[2]!);
  });

  it('returns nothing for an empty basket', () => {
    expect(layOutRow([], 212, 1.08).offsets).toEqual([]);
  });
});

/**
 * The basket swings a long way at full tilt, and an animal that hangs out of it
 * hangs off the screen. This is the guard on that: it walks the real geometry
 * with the real artwork rather than trusting the numbers to stay in step.
 */
describe('the painted seesaw stays on screen', () => {
  it('keeps every corner of both trays in frame, at rest and at full tilt', () => {
    // The tray's four corners, measured from the bolt in the painting's pixels.
    const corners = [-PARK.trayOuter, PARK.trayOuter].flatMap((dx) =>
      [-PARK.trayTop, PARK.trayDrop].map((dy) => ({ dx, dy })),
    );
    for (const tilt of [-SCENE.maxTiltRad, 0, SCENE.maxTiltRad]) {
      for (const { dx, dy } of corners) {
        const x = SCENE.fulcrumX + (dx * Math.cos(tilt) - dy * Math.sin(tilt)) * PARK_SCALE;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(DESIGN.width);
      }
    }
  });
});

describe('animals stay on screen at full tilt', () => {
  it('keeps every animal inside the frame', () => {
    for (const tilt of [-SCENE.maxTiltRad, 0, SCENE.maxTiltRad]) {
      for (const side of ['left', 'right'] as const) {
        const anchor = platformAnchor(side, tilt);
        const slide = Math.sin(tilt) * 26 * (side === 'left' ? -1 : 1) * -1;
        for (let count = 1; count <= 5; count += 1) {
          for (const species of ANIMAL_IDS) {
            const width = ANIMAL_ART[species].height * ANIMAL_ART[species].aspect;
            const row = layOutRow(new Array(count).fill(width), SCENE.basketInner, 1.08);
            for (const offset of row.offsets) {
              const centre = anchor.x + offset * Math.cos(tilt) + slide;
              const half = (width * row.scale) / 2;
              expect(centre - half).toBeGreaterThanOrEqual(0);
              expect(centre + half).toBeLessThanOrEqual(DESIGN.width);
            }
          }
        }
      }
    }
  });
});

describe('scene fits the design space', () => {
  it('keeps both baskets on screen at full tilt', () => {
    const halfBasket = SCENE.platformWidth / 2;
    for (const side of ['left', 'right'] as const) {
      for (const tilt of [-SCENE.maxTiltRad, 0, SCENE.maxTiltRad]) {
        const anchor = platformAnchor(side, tilt);
        expect(anchor.x - halfBasket).toBeGreaterThanOrEqual(0);
        expect(anchor.x + halfBasket).toBeLessThanOrEqual(DESIGN.width);
      }
    }
  });

  it('keeps the tray clear of the ground line and the bottom edge', () => {
    expect(SCENE.trayY).toBeGreaterThan(SCENE.groundY);
    expect(SCENE.trayY + 60).toBeLessThanOrEqual(DESIGN.height);
  });
});

/**
 * The scene is tuned to fill the screen, which means every dimension sits close
 * to something it must not collide with. These fix the clearances so a later
 * nudge to one number cannot quietly push a basket through the ground.
 */
describe('the seesaw fits its frame at full tilt', () => {
  const cornerReach = SCENE.plankHalfLength + SCENE.platformWidth / 2;
  const swing = cornerReach * Math.sin(SCENE.maxTiltRad);
  /** The basket hangs below the board it is bolted to, and that hangs lowest. */
  const basketBottom = PARK.trayDrop * PARK_SCALE;

  it('keeps the low basket clear of the ground', () => {
    expect(SCENE.fulcrumY + swing + basketBottom).toBeLessThan(SCENE.groundY - 8);
  });

  it('keeps the high basket clear of the gauge', () => {
    const gaugeBottom = SCENE.gaugeY + 22;
    expect(SCENE.fulcrumY - swing - SCENE.basketWall).toBeGreaterThan(gaugeBottom + 10);
  });

  it('keeps both baskets on screen at full tilt', () => {
    for (const tilt of [-SCENE.maxTiltRad, SCENE.maxTiltRad]) {
      for (const side of ['left', 'right'] as const) {
        const anchor = platformAnchor(side, tilt);
        expect(anchor.x - SCENE.platformWidth / 2).toBeGreaterThanOrEqual(0);
        expect(anchor.x + SCENE.platformWidth / 2).toBeLessThanOrEqual(DESIGN.width);
      }
    }
  });

  it('leaves the tray on the grass and inside the frame', () => {
    expect(SCENE.trayY).toBeGreaterThan(SCENE.groundY);
    expect(SCENE.trayY + 62).toBeLessThanOrEqual(DESIGN.height);
  });
});

describe('the tray sits clear of the seesaw', () => {
  it('starts below the ground line, where the fulcrum ends', () => {
    const trayTop = SCENE.trayY - 44;
    expect(trayTop).toBeGreaterThan(SCENE.groundY);
  });
});

describe('the goal announcement keeps out of the way', () => {
  it('arrives above a resting seesaw rather than across it', () => {
    // A goal announces itself at the start of a level or challenge, when the
    // plank is at or near level. At full tilt the raised basket sweeps most of
    // the sky, so clearance is measured against the resting plank.
    const seesawTopAtRest = SCENE.fulcrumY - SCENE.platformHeight - SCENE.basketWall;
    const cardBottom = 196 + 30;
    expect(cardBottom).toBeLessThan(seesawTopAtRest);
  });
});

describe('the top bar does not stack on itself', () => {
  it('keeps the bells clear of the clock above them', () => {
    const clockBottom = SCENE.gaugeY + 34 + 18;
    const bellTop = 144 - 14;
    expect(bellTop).toBeGreaterThan(clockBottom);
  });
});

describe('the tray gives groups room', () => {
  it('keeps group pens from overlapping', () => {
    const tray = [
      { uid: 'a', species: 'cat' as const, count: 2, used: false },
      { uid: 'b', species: 'cat' as const, count: 3, used: false },
      { uid: 'c', species: 'cat' as const, count: 4, used: false },
    ];
    const slots = traySlots(tray);
    for (let index = 1; index < slots.length; index++) {
      const gap = slots[index]!.x - slots[index - 1]!.x;
      expect(gap).toBeGreaterThan(slots[index]!.radius + slots[index - 1]!.radius);
    }
  });

  it('keeps the whole tray on screen', () => {
    const tray = Array.from({ length: 3 }, (_, index) => ({
      uid: `t${index}`,
      species: 'cat' as const,
      count: 4,
      used: false,
    }));
    for (const slot of traySlots(tray)) {
      expect(slot.x - slot.radius).toBeGreaterThan(0);
      expect(slot.x + slot.radius).toBeLessThan(DESIGN.width);
    }
  });
});

describe('a group can be counted', () => {
  it('never hides one animal behind another', () => {
    // The question in that chapter is "how many?", so every member has to be
    // separately visible.
    for (const count of [2, 3, 4]) {
      const offsets = groupOffsets(count);
      expect(offsets).toHaveLength(count);
      for (let a = 0; a < offsets.length; a++) {
        for (let b = a + 1; b < offsets.length; b++) {
          const gap = Math.hypot(offsets[a]!.x - offsets[b]!.x, offsets[a]!.y - offsets[b]!.y);
          // An animal is about 48 units across at full size.
          expect(gap, `${count}: ${a} vs ${b}`).toBeGreaterThan(48 * offsets[a]!.scale);
        }
      }
    }
  });

  it('keeps a group inside its pen', () => {
    const tray = [{ uid: 'a', species: 'cat' as const, count: 4, used: false }];
    const slot = traySlots(tray)[0]!;
    for (const offset of groupOffsets(4)) {
      expect(Math.abs(offset.x) + 24 * offset.scale).toBeLessThan(slot.radius);
    }
  });
});


describe('the tray stays on screen', () => {
  it('keeps a tall group pen inside the frame', () => {
    const tray = [{ uid: 'a', species: 'cat' as const, count: 4, used: false }];
    const slot = traySlots(tray)[0]!;
    // The pen a group is drawn in, as the hud lays it out.
    const height = 42 * 2 + 56;
    const top = slot.y - height / 2 - 26;
    // Fully on screen. It may overlap the fence line behind it; that reads as
    // a pen standing in front of the fence, which is what it is.
    expect(top).toBeGreaterThan(0);
    expect(top + height).toBeLessThanOrEqual(DESIGN.height);
  });
});
