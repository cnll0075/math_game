import { DESIGN, type Bounds } from './layout.js';
import { SCENE, platformAnchor } from './geometry.js';
import { vectorAnimalArtist } from './animals-art.js';
import type { SeesawTheme, SeesawView } from './theme.js';

/**
 * Prototype scenery: flat vector shapes, no assets, strong silhouettes. The
 * seesaw and the animals are the focus; everything else stays quiet.
 */

const SKY_TOP = '#bfe6f5';
const SKY_BOTTOM = '#e8f6fb';
const GRASS = '#8fce72';
const GRASS_DARK = '#6fb257';
const WOOD = '#c98d4f';
// Taken from the playground the backdrop is painted from, so the seesaw we draw
// looks like it came with the park.
const FULCRUM = '#1781d6';
const FULCRUM_SHADE = '#1274c8';
const BOLT = '#feca15';
const WOOD_DARK = '#a06c37';
const INK = '#3a2f2a';

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [cx, cy, r] of [
    [-26, 4, 18],
    [0, -6, 24],
    [26, 4, 18],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawTree = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#8a5a3b';
  ctx.fillRect(-7, -40, 14, 52);
  ctx.fillStyle = '#5fa650';
  for (const [cx, cy, r] of [
    [0, -74, 38],
    [-26, -50, 28],
    [26, -50, 28],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawFence = (ctx: CanvasRenderingContext2D, y: number, bounds: Bounds): void => {
  ctx.fillStyle = '#f2e4cd';
  ctx.strokeStyle = '#d8c3a2';
  ctx.lineWidth = 2;
  // Start on a fixed grid so the pickets do not slide about as the window
  // changes shape.
  const first = Math.floor(bounds.left / 46) * 46;
  for (let x = first; x < bounds.right; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x + 14, y - 40);
    ctx.lineTo(x + 7, y - 50);
    ctx.lineTo(x, y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#e7d5b6';
  ctx.fillRect(bounds.left, y - 32, bounds.right - bounds.left, 8);
};

export const drawFlowers = (ctx: CanvasRenderingContext2D): void => {
  const spots = [
    [96, 690],
    [196, 730],
    [960, 698],
    [1064, 736],
    [320, 744],
    [800, 740],
  ] as const;
  for (const [x, y] of spots) {
    ctx.fillStyle = '#f7d05e';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const drawPlatform = (ctx: CanvasRenderingContext2D, side: 'left' | 'right', view: SeesawView): void => {
  const anchor = platformAnchor(side, view.plankAngle);
  const halfWidth = SCENE.platformWidth / 2;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(anchor.angle);

  // A shallow basket: the floor the animals stand on, plus low walls. The walls
  // are what keep five animals reading as five animals instead of a pile.
  ctx.fillStyle = WOOD;
  roundRect(ctx, -halfWidth, -SCENE.platformHeight, SCENE.platformWidth, SCENE.platformHeight, 6);
  ctx.fill();
  ctx.fillStyle = WOOD_DARK;
  roundRect(ctx, -halfWidth, -4, SCENE.platformWidth, 6, 3);
  ctx.fill();

  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const direction of [-1, 1]) {
    const x = direction * halfWidth;
    ctx.beginPath();
    ctx.moveTo(x, -SCENE.platformHeight);
    ctx.lineTo(x + direction * 8, -SCENE.platformHeight - SCENE.basketWall);
    ctx.stroke();
  }
  ctx.restore();
};

export function createVectorTheme(): SeesawTheme {
  return {
    async preload() {
      // Nothing to load: every shape is drawn from primitives.
    },

    drawBackground(ctx, view) {
      // Everything here paints across the visible bounds rather than the design
      // rect, so a screen of any shape is filled with park instead of bars.
      const { bounds } = view;
      const width = bounds.right - bounds.left;
      const sky = ctx.createLinearGradient(0, bounds.top, 0, SCENE.groundY);
      sky.addColorStop(0, SKY_TOP);
      sky.addColorStop(1, SKY_BOTTOM);
      ctx.fillStyle = sky;
      ctx.fillRect(bounds.left, bounds.top, width, SCENE.groundY - bounds.top);

      drawCloud(ctx, 200, 118, 1);
      drawCloud(ctx, 880, 88, 1.3);
      drawCloud(ctx, 580, 166, 0.7);

      drawTree(ctx, bounds.left + 78, SCENE.groundY, 1.05);
      drawTree(ctx, bounds.right - 96, SCENE.groundY, 0.9);

      ctx.fillStyle = GRASS;
      ctx.fillRect(bounds.left, SCENE.groundY, width, bounds.bottom - SCENE.groundY);
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(bounds.left, SCENE.groundY, width, 8);

      drawFence(ctx, SCENE.groundY, bounds);
      drawFlowers(ctx);
    },

    drawSeesaw(ctx, view) {
      // Fulcrum, in the painted playground's own blue plastic with its yellow
      // bolt, so the seesaw belongs to the park it stands in.
      ctx.fillStyle = FULCRUM;
      ctx.beginPath();
      ctx.moveTo(SCENE.fulcrumX - SCENE.fulcrumHalfWidth, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX + SCENE.fulcrumHalfWidth, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX, SCENE.fulcrumY - 6);
      ctx.closePath();
      ctx.fill();

      // A darker face down one side, so it reads as moulded rather than flat.
      ctx.fillStyle = FULCRUM_SHADE;
      ctx.beginPath();
      ctx.moveTo(SCENE.fulcrumX, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX + SCENE.fulcrumHalfWidth, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX, SCENE.fulcrumY - 6);
      ctx.closePath();
      ctx.fill();

      // The foot it stands on.
      ctx.fillStyle = FULCRUM_SHADE;
      roundRect(ctx, SCENE.fulcrumX - SCENE.fulcrumHalfWidth - 8, SCENE.groundY - 14, SCENE.fulcrumHalfWidth * 2 + 16, 20, 8);
      ctx.fill();

      // Plank.
      ctx.save();
      ctx.translate(SCENE.fulcrumX, SCENE.fulcrumY);
      ctx.rotate(view.plankAngle);
      ctx.fillStyle = WOOD;
      roundRect(ctx, -SCENE.plankHalfLength - 26, -SCENE.plankThickness / 2, (SCENE.plankHalfLength + 26) * 2, SCENE.plankThickness, 8);
      ctx.fill();
      ctx.fillStyle = WOOD_DARK;
      roundRect(ctx, -SCENE.plankHalfLength - 26, SCENE.plankThickness / 2 - 5, (SCENE.plankHalfLength + 26) * 2, 5, 2);
      ctx.fill();
      ctx.restore();

      // The bolt the plank turns on.
      ctx.fillStyle = BOLT;
      ctx.beginPath();
      ctx.arc(SCENE.fulcrumX, SCENE.fulcrumY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 130, 10, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      drawPlatform(ctx, 'left', view);
      drawPlatform(ctx, 'right', view);

      if (view.targetAngle !== null) {
        // A ghost of the plank where it should end up. The star sits at the end
        // of this, not above it: one goal, one thing to aim at.
        ctx.save();
        ctx.translate(SCENE.fulcrumX, SCENE.fulcrumY);
        ctx.rotate(view.targetAngle);
        ctx.fillStyle = 'rgba(255, 210, 63, 0.32)';
        roundRect(
          ctx,
          -SCENE.plankHalfLength - 26,
          -SCENE.plankThickness / 2,
          (SCENE.plankHalfLength + 26) * 2,
          SCENE.plankThickness,
          8,
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(224, 165, 0, 0.75)';
        ctx.lineWidth = 3;
        ctx.setLineDash?.([13, 10]);
        ctx.stroke();
        ctx.setLineDash?.([]);
        ctx.restore();
      }
    },

    drawTarget(ctx, view) {
      if (view.targetAngle === null) return;
      // Planted at the end of the ghost plank, so bringing the plank to the
      // star is literally the goal rather than a second thing to interpret.
      const anchor = platformAnchor('right', view.targetAngle);
      const reached = Math.abs(view.plankAngle - view.targetAngle) < 0.015;
      const beat = reached ? 1 + Math.sin(view.time * 7) * 0.12 : 1;

      ctx.save();
      ctx.translate(anchor.x, anchor.y - SCENE.platformHeight / 2);
      ctx.rotate(reached ? 0 : Math.sin(view.time * 1.4) * 0.12);
      ctx.scale(beat, beat);

      if (reached) {
        ctx.fillStyle = 'rgba(255, 210, 63, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = reached ? '#ffe071' : '#ffd23f';
      ctx.strokeStyle = '#e0a500';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 24 : 10;
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },

    drawGauge(ctx, view) {
      const width = SCENE.gaugeWidth;
      const x = (DESIGN.width - width) / 2;
      const y = SCENE.gaugeY;
      const height = 22;

      const bands: Array<[number, number, string]> = [
        [0, 0.18, '#e4695f'],
        [0.18, 0.36, '#f2b950'],
        [0.36, 0.64, '#63c07a'],
        [0.64, 0.82, '#f2b950'],
        [0.82, 1, '#e4695f'],
      ];
      ctx.save();
      roundRect(ctx, x, y, width, height, height / 2);
      ctx.clip();
      for (const [from, to, color] of bands) {
        ctx.fillStyle = color;
        ctx.fillRect(x + from * width, y, (to - from) * width, height);
      }
      ctx.restore();

      roundRect(ctx, x, y, width, height, height / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Needle: positive normalized balance means the left is heavier, so the
      // needle leans left.
      const needleX = x + width / 2 - (view.needle * width) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(needleX, y - 8);
      ctx.lineTo(needleX + 9, y + height / 2);
      ctx.lineTo(needleX, y + height + 8);
      ctx.lineTo(needleX - 9, y + height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },

    drawFlag(ctx, view) {
      if (view.flagHeight <= 0.01 || !view.flagSide) return;
      const anchor = platformAnchor(view.flagSide, view.plankAngle);
      // Planted at the outer end of the heavy basket rather than its middle,
      // where the animals standing in the basket would hide it.
      const outward = view.flagSide === 'left' ? -1 : 1;
      const height = 100 * view.flagHeight;

      ctx.save();
      ctx.translate(anchor.x, anchor.y);
      ctx.rotate(view.plankAngle);
      ctx.translate(outward * (SCENE.platformWidth / 2 + 4), -SCENE.platformHeight);

      ctx.strokeStyle = '#6d4c33';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -height);
      ctx.stroke();

      ctx.fillStyle = '#e4695f';
      ctx.beginPath();
      ctx.moveTo(0, -height);
      ctx.lineTo(outward * 50 * view.flagHeight, -height + 15);
      ctx.lineTo(0, -height + 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    drawDanger(ctx, view) {
      if (view.danger <= 0.01) return;
      // A red glow pulsing in from the edges. Nothing is lost and nothing ends:
      // it says "this is very tilted" in a way that needs no reading, and it
      // fades the moment the seesaw comes back.
      const { bounds } = view;
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      const centreX = (bounds.left + bounds.right) / 2;
      const centreY = (bounds.top + bounds.bottom) / 2;
      const radius = Math.hypot(width, height) / 2;
      const pulse = 0.68 + Math.sin(view.time * 6) * 0.32;
      const strength = view.danger * pulse;

      ctx.save();
      const glow = ctx.createRadialGradient(centreX, centreY, radius * 0.3, centreX, centreY, radius);
      glow.addColorStop(0, 'rgba(228, 105, 95, 0)');
      glow.addColorStop(0.65, `rgba(219, 76, 66, ${(0.3 * strength).toFixed(3)})`);
      glow.addColorStop(1, `rgba(190, 40, 34, ${(0.85 * strength).toFixed(3)})`);
      ctx.fillStyle = glow;
      ctx.fillRect(bounds.left, bounds.top, width, height);

      // A band around the very edge, so the warning reads even on a bright sky.
      ctx.strokeStyle = `rgba(214, 62, 52, ${(0.9 * strength).toFixed(3)})`;
      ctx.lineWidth = 26;
      ctx.strokeRect(bounds.left + 13, bounds.top + 13, width - 26, height - 26);
      ctx.restore();
    },

    drawCelebration(ctx, view) {
      if (view.celebrate <= 0.01) return;
      // Petals drift down across the whole scene. Positions come from the clock
      // rather than from stored particles, so there is no state to reset and a
      // celebration looks the same every time it plays.
      ctx.save();
      ctx.globalAlpha = Math.min(1, view.celebrate);
      // Saturated enough to read against both the pale sky and the grass;
      // the pastel first attempt vanished into both.
      const colors = ['#ff7fa8', '#ffc21f', '#ff9f6b', '#ffffff', '#b078e8'];
      const spread = view.bounds.right - view.bounds.left;
      const depth = view.bounds.bottom - view.bounds.top;
      for (let i = 0; i < 34; i++) {
        const seed = i * 97.13;
        const x = view.bounds.left + ((seed * 7.3) % spread);
        const drift = Math.sin(view.time * 1.1 + i) * 26;
        const fall = view.bounds.top + ((view.time * 74 + seed * 3.1) % (depth + 120)) - 60;
        const spin = view.time * 2 + i;
        ctx.save();
        ctx.translate(x + drift, fall);
        ctx.rotate(spin);
        ctx.fillStyle = colors[i % colors.length]!;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 70, 90, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },

    animals: vectorAnimalArtist,
  };
}
