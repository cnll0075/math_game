import { DESIGN } from './layout.js';

/** Fixed points of the scene, in design coordinates. */
export const SCENE = {
  groundY: 620,
  fulcrumX: DESIGN.width / 2,
  fulcrumY: 500,
  fulcrumHalfWidth: 54,
  plankHalfLength: 330,
  plankThickness: 20,
  platformWidth: 300,
  platformHeight: 14,
  /** Where the tray of available animals sits. */
  trayY: 690,
  gaugeY: 84,
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
