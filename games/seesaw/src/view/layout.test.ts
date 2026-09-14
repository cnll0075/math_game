import { describe, it, expect } from 'vitest';
import { DESIGN, fitToScreen, slotPositions, visibleBounds } from './layout.js';
import { SCENE, platformAnchor } from './geometry.js';
import { ROUND_DOTS_Y, traySlots } from './hud.js';

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

describe('slotPositions', () => {
  it('spaces animals without overlapping, for one through five', () => {
    for (let count = 1; count <= 5; count++) {
      const xs = slotPositions(count, 320);
      expect(xs).toHaveLength(count);
      for (let i = 1; i < count; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(40);
    }
  });

  it('centres the row on the platform', () => {
    for (let count = 1; count <= 5; count++) {
      const xs = slotPositions(count, 320);
      expect(xs[0]! + xs[count - 1]!).toBeCloseTo(0);
    }
  });

  it('keeps animals on the platform', () => {
    for (let count = 1; count <= 6; count++) {
      for (const x of slotPositions(count, 320)) expect(Math.abs(x)).toBeLessThanOrEqual(160);
    }
  });

  it('returns nothing for an empty platform', () => {
    expect(slotPositions(0, 320)).toEqual([]);
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

  it('keeps the low basket clear of the ground', () => {
    expect(SCENE.fulcrumY + swing).toBeLessThan(SCENE.groundY - 8);
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

describe('the top of the screen does not stack on itself', () => {
  it('keeps the round markers clear of the gauge above them', () => {
    const gaugeBottom = SCENE.gaugeY + 22;
    expect(ROUND_DOTS_Y - 14).toBeGreaterThan(gaugeBottom);
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
