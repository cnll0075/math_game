import { DESIGN } from './layout.js';
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

const drawFence = (ctx: CanvasRenderingContext2D, y: number): void => {
  ctx.fillStyle = '#f2e4cd';
  ctx.strokeStyle = '#d8c3a2';
  ctx.lineWidth = 2;
  for (let x = 24; x < DESIGN.width - 24; x += 46) {
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
  ctx.fillRect(24, y - 32, DESIGN.width - 48, 8);
};

const drawFlowers = (ctx: CanvasRenderingContext2D): void => {
  const spots = [
    [90, 660],
    [180, 700],
    [860, 668],
    [940, 706],
    [300, 716],
    [700, 712],
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

    drawBackground(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, SCENE.groundY);
      sky.addColorStop(0, SKY_TOP);
      sky.addColorStop(1, SKY_BOTTOM);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, DESIGN.width, SCENE.groundY);

      drawCloud(ctx, 180, 120, 1);
      drawCloud(ctx, 780, 92, 1.3);
      drawCloud(ctx, 520, 170, 0.7);

      drawTree(ctx, 96, SCENE.groundY, 1.05);
      drawTree(ctx, 940, SCENE.groundY, 0.9);

      ctx.fillStyle = GRASS;
      ctx.fillRect(0, SCENE.groundY, DESIGN.width, DESIGN.height - SCENE.groundY);
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(0, SCENE.groundY, DESIGN.width, 8);

      drawFence(ctx, SCENE.groundY);
      drawFlowers(ctx);
    },

    drawSeesaw(ctx, view) {
      // Fulcrum.
      ctx.fillStyle = WOOD_DARK;
      ctx.beginPath();
      ctx.moveTo(SCENE.fulcrumX - SCENE.fulcrumHalfWidth, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX + SCENE.fulcrumHalfWidth, SCENE.groundY);
      ctx.lineTo(SCENE.fulcrumX, SCENE.fulcrumY - 6);
      ctx.closePath();
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

      ctx.fillStyle = '#6d4c33';
      ctx.beginPath();
      ctx.arc(SCENE.fulcrumX, SCENE.fulcrumY, 11, 0, Math.PI * 2);
      ctx.fill();

      drawPlatform(ctx, 'left', view);
      drawPlatform(ctx, 'right', view);

      if (view.targetAngle !== null) {
        // A ghost of where the plank should end up, plus a star at the end of
        // it. Without the ghost line the star reads as decoration rather than
        // as the thing being aimed at.
        ctx.save();
        ctx.translate(SCENE.fulcrumX, SCENE.fulcrumY);
        ctx.rotate(view.targetAngle);
        ctx.strokeStyle = 'rgba(224, 165, 0, 0.5)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.setLineDash?.([14, 12]);
        ctx.beginPath();
        ctx.moveTo(-SCENE.plankHalfLength, 0);
        ctx.lineTo(SCENE.plankHalfLength, 0);
        ctx.stroke();
        ctx.setLineDash?.([]);
        ctx.restore();

      }
    },

    drawTarget(ctx, view) {
      if (view.targetAngle === null) return;
      const anchor = platformAnchor('right', view.targetAngle);
      ctx.save();
      ctx.translate(anchor.x, anchor.y - SCENE.platformHeight - SCENE.basketWall - 30);
      ctx.rotate(Math.sin(view.time * 1.4) * 0.12);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#e0a500';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 21 : 9;
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
      const height = 90 * view.flagHeight;
      ctx.save();
      ctx.translate(anchor.x, anchor.y - SCENE.platformHeight);
      ctx.rotate(view.plankAngle);
      ctx.strokeStyle = '#6d4c33';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -height);
      ctx.stroke();
      ctx.fillStyle = '#e4695f';
      ctx.beginPath();
      ctx.moveTo(0, -height);
      ctx.lineTo(44 * view.flagHeight, -height + 14);
      ctx.lineTo(0, -height + 28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    drawGate(ctx, view) {
      // The gate stands at the edge of the park and swings open when the level
      // is complete: the reward is a bit more world, not a score screen.
      // Seen from the side, a gate swinging away from the viewer foreshortens
      // rather than rotating, so the panel narrows from its hinge.
      const x = DESIGN.width - 178;
      const y = SCENE.groundY;
      const height = 96;
      const width = 82;

      ctx.save();
      ctx.fillStyle = '#bfa587';
      ctx.fillRect(x - 10, y - height - 10, 12, height + 10);
      ctx.fillRect(x + width + 2, y - height - 10, 12, height + 10);

      ctx.save();
      ctx.translate(x + 2, y - height);
      // Hinged on the left post: the far edge sweeps toward it as it opens.
      ctx.transform(1 - view.gateOpen * 0.86, 0, view.gateOpen * 0.22, 1, 0, 0);
      ctx.fillStyle = '#d9c2a0';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#a98e6c';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.stroke();
      ctx.restore();

      // A path through the opened gate, revealed as it swings.
      if (view.gateOpen > 0.05) {
        ctx.globalAlpha = Math.min(1, view.gateOpen);
        ctx.fillStyle = '#cbb58f';
        ctx.beginPath();
        ctx.moveTo(x + 10, y);
        ctx.lineTo(x + width - 6, y);
        ctx.lineTo(x + width + 24, y + 60);
        ctx.lineTo(x - 10, y + 60);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },


    animals: vectorAnimalArtist,
  };
}
