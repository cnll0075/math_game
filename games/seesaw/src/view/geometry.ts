import { DESIGN } from './layout.js';

/** Fixed points of the scene, in design coordinates. */
export const SCENE = {
  groundY: 582,
  fulcrumX: DESIGN.width / 2,
  fulcrumY: 396,
  fulcrumHalfWidth: 62,
  // Arm length plus half a basket must stay inside the design space, or the
  // baskets get clipped at the edges when the plank tilts.
  plankHalfLength: 330,
  plankThickness: 22,
  platformWidth: 300,
  platformHeight: 16,
  /** Height of the basket walls that keep animals readable as a group. */
  basketWall: 46,
  /** Where the tray of available animals sits. */
  trayY: 688,
  gaugeY: 74,
  gaugeWidth: 420,
  /** Largest visual tilt, in radians, at full normalized balance. */
  maxTiltRad: (22 * Math.PI) / 180,
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
