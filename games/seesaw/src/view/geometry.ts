import { DESIGN } from './layout.js';

/**
 * The painted park, and where the seesaw stands in it, in the painting's own
 * pixels. Every number below is measured off `assets/source/park.png`, so the
 * scene and the sprites cut out of it can never drift apart.
 */
export const PARK = {
  width: 1991,
  height: 789,
  /**
   * Rows of sky the cut backdrop adds above the painting. The painting is far
   * wider than it is tall, so there is always bare space above it on a screen,
   * and its top edge is tree and cloud rather than sky: stretching that edge to
   * fill the space smeared both into streaks. Must match SKY_HEADROOM in
   * `scripts/cut-seesaw.py`.
   */
  skyHeadroom: 300,
  /** The bolt the plank turns on. */
  pivotX: 996,
  pivotY: 468,
  /** Where the post meets the dirt. */
  groundY: 640,
  /** Distance from the bolt to the middle of a tray. */
  arm: 525.5,
  /**
   * Distance from the bolt to the far edge of a tray. The painting's two trays
   * are not quite the same distance out, and this is the longer of them, which
   * is what actually decides how big the seesaw can be drawn.
   */
  trayOuter: 682,
  /** How far the tray's back rim stands above the plank. */
  trayTop: 96,
  /** Outside width of a tray. */
  trayWidth: 297,
  /** How far the tray's near wall rises above the plank. */
  trayWall: 68,
  /** How far the top of the post stands above the bolt. */
  postTop: 51,
  /** How far the tray hangs below the plank, which is what limits the tilt. */
  trayDrop: 40,
  /**
   * How much taller the cut post is than the painted one. The park's own seesaw
   * is level and decorative, so its post is squat; a plank that has to lean
   * would put the low tray in the dirt first. Must match STRETCH_BY in
   * `scripts/cut-seesaw.py`.
   */
  postStretch: 120,
  /** The shared sprite canvas that `scripts/cut-seesaw.py` writes. */
  sprite: { width: 1400, height: 640, pivotX: 700, pivotY: 240 },
} as const;

/**
 * The margin kept between the seesaw's widest point and the edge of the screen.
 * Small, because the seesaw is meant to fill the frame, but not nothing: a tray
 * touching the bezel reads as broken art rather than as a big seesaw.
 */
const EDGE_MARGIN = 12;

/**
 * How big the painting is drawn, in design units per painted pixel. Set by the
 * one thing that cannot give: the far corner of the longer tray has to stay on
 * screen, and it reaches furthest when the plank is level.
 */
export const PARK_SCALE = (DESIGN.width / 2 - EDGE_MARGIN) / PARK.trayOuter;

/** Fixed points of the scene, in design coordinates. */
export const SCENE = {
  groundY: 648,
  fulcrumX: DESIGN.width / 2,
  fulcrumY: 648 - (PARK.groundY - PARK.pivotY + PARK.postStretch) * PARK_SCALE,
  fulcrumHalfWidth: 84,
  plankHalfLength: PARK.arm * PARK_SCALE,
  plankThickness: 28,
  platformWidth: PARK.trayWidth * PARK_SCALE,
  platformHeight: 18,
  /** Height of the basket walls that keep animals readable as a group. */
  basketWall: 54,
  /** The top of the painted tray's back rim, measured from the plank. */
  basketRim: 103 * PARK_SCALE,
  /** The top of the post, where the flag for a level plank is planted. */
  postTopY: 648 - (PARK.groundY - PARK.pivotY + PARK.postStretch + PARK.postTop) * PARK_SCALE,
  /** The width a row of animals has to fit inside the painted basket. */
  basketInner: PARK.trayWidth * PARK_SCALE - 40,
  /** The top of the painted tray's near wall, measured from the plank. */
  basketWallTop: PARK.trayWall * PARK_SCALE,
  /**
   * How much of an animal the near wall hides. A depth rather than a height:
   * measured from the floor, a crowd that has shrunk to fit sinks out of sight
   * behind the wall, and only the ears of the smallest ones are left. Measured
   * as a share of each animal, everyone rides at the same depth however big
   * they are drawn, which is how the painting has them.
   */
  submerge: 0.46,
  /** Where the tray of available animals sits. */
  trayY: 706,
  gaugeY: 62,
  gaugeWidth: 460,
  /**
   * Largest visual tilt at full normalized balance: as steep as the plank can
   * lean before the low tray is in the dirt.
   */
  maxTiltRad: (20 * Math.PI) / 180,
} as const;

export interface PlatformAnchor {
  x: number;
  y: number;
  angle: number;
}

/** Where a platform's surface sits for a given plank angle. */
export function platformAnchor(side: 'left' | 'right', plankAngle: number): PlatformAnchor {
  const direction = side === 'left' ? -1 : 1;
  const armX = direction * SCENE.plankHalfLength;
  return {
    x: SCENE.fulcrumX + armX * Math.cos(plankAngle),
    y: SCENE.fulcrumY + armX * Math.sin(plankAngle),
    angle: plankAngle,
  };
}
