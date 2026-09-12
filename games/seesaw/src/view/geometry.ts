import { DESIGN } from './layout.js';

/** Fixed points of the scene, in design coordinates. */
export const SCENE = {
  groundY: 648,
  fulcrumX: DESIGN.width / 2,
  fulcrumY: 396,
  fulcrumHalfWidth: 84,
  // Arm length plus half a basket must stay inside the design space, or the
  // baskets get clipped at the edges when the plank tilts. This is the longest
  // arm that fits, so the seesaw fills as much of the screen as it can.
  plankHalfLength: 414,
  plankThickness: 28,
  platformWidth: 300,
  platformHeight: 18,
  /** Height of the basket walls that keep animals readable as a group. */
  basketWall: 54,
  /** Where the tray of available animals sits. */
  trayY: 706,
  gaugeY: 62,
  gaugeWidth: 460,
  /**
   * Largest visual tilt at full normalized balance. As steep as it can be
   * while the low basket's outer corner still clears the ground.
   */
  maxTiltRad: (25 * Math.PI) / 180,
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
