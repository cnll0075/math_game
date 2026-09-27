import { hand, type Point } from '@bundle/core';
import { LANES } from '../logic/lanes.js';
import type { Jitter, ObstacleKind } from '../logic/row.js';
import { laneWidth, obstacleSize, PATH, PATH_WIDTH, pathPoint, RUN_HEIGHT } from './geometry.js';

/** The track, with lane lines and a texture that scrolls to say "moving". */
export function drawPath(ctx: CanvasRenderingContext2D, scroll: number): void {
  ctx.save();
  ctx.fillStyle = '#cbe6a4';
  ctx.fillRect(PATH.left, PATH.horizonY - 60, PATH_WIDTH, RUN_HEIGHT + 220);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = PATH.left + lane * laneWidth();
    ctx.beginPath();
    ctx.moveTo(x, PATH.horizonY - 60);
    ctx.lineTo(x, PATH.rabbitY + 160);
    ctx.stroke();
  }

  // Tufts of grass sliding down the track: the only thing on screen saying the
  // rabbit is moving rather than the world standing still.
  ctx.fillStyle = 'rgba(120,170,90,0.45)';
  const rows = 9;
  for (let i = 0; i < rows; i += 1) {
    const y = PATH.horizonY + (((i / rows + scroll) % 1) * (RUN_HEIGHT + 180)) - 60;
    for (let lane = 0; lane < LANES; lane += 1) {
      const x = PATH.left + (lane + 0.28 + (0.44 * ((i * 7) % 3)) / 3) * laneWidth();
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const OBSTACLE_SKIN: Record<ObstacleKind, { body: string; dark: string; light: string }> = {
  rock: { body: '#9aa3ad', dark: '#6d757e', light: '#c3cad2' },
  bear: { body: '#a9754c', dark: '#7a5233', light: '#c99a72' },
  log: { body: '#b5793f', dark: '#7d5026', light: '#d8a469' },
};

/**
 * The number on a pale disc rather than straight onto the obstacle. Written
 * across a bear or a boulder it fought with the shape underneath and neither
 * read; on a disc the shape can be a shape and the number can be a number.
 */
const numberBadge = (ctx: CanvasRenderingContext2D, value: number, size: number): void => {
  const radius = size * 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(40,52,64,0.25)';
  ctx.stroke();
  ctx.font = hand(700, radius * 1.05);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(String(value), 0, size * 0.015);
};

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  at: Point,
  kind: ObstacleKind,
  number: number,
  jitter: Jitter = { scale: 1, tilt: 0, lift: 0 },
): void {
  const base = obstacleSize();
  const width = base.width * jitter.scale;
  const height = base.height * jitter.scale;
  const skin = OBSTACLE_SKIN[kind];

  ctx.save();
  ctx.translate(at.x, at.y);

  // A soft shadow on the grass, so it sits on the path rather than floating.
  ctx.fillStyle = 'rgba(70,100,50,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.52, width * 0.44, height * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(jitter.tilt);

  if (kind === 'rock') {
    // A boulder: a rounded lump with a lit top and a darker base.
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.moveTo(-width * 0.46, height * 0.42);
    ctx.quadraticCurveTo(-width * 0.54, -height * 0.12, -width * 0.24, -height * 0.4);
    ctx.quadraticCurveTo(0, -height * 0.58, width * 0.26, -height * 0.38);
    ctx.quadraticCurveTo(width * 0.54, -height * 0.1, width * 0.44, height * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.light;
    ctx.beginPath();
    ctx.moveTo(-width * 0.2, -height * 0.38);
    ctx.quadraticCurveTo(0, -height * 0.56, width * 0.22, -height * 0.36);
    ctx.quadraticCurveTo(0, -height * 0.2, -width * 0.2, -height * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.dark;
    ctx.beginPath();
    ctx.ellipse(0, height * 0.4, width * 0.45, height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'log') {
    // A log lying across the lane: bark along the top, rings on the cut end.
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.roundRect?.(-width * 0.44, -height * 0.34, width * 0.88, height * 0.68, height * 0.22);
    ctx.fill();
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = Math.max(2, height * 0.05);
    for (const at2 of [-0.12, 0.1]) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.3, height * at2);
      ctx.lineTo(width * 0.24, height * at2);
      ctx.stroke();
    }
    // The sawn end, turned towards the player.
    ctx.fillStyle = skin.light;
    ctx.beginPath();
    ctx.ellipse(-width * 0.42, 0, height * 0.16, height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-width * 0.42, 0, height * 0.08, height * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // A bear, seen face-on: round ears, a muzzle and two eyes. Cute rather than
    // frightening — it is an obstacle in a child's game, not a threat.
    ctx.fillStyle = skin.dark;
    ctx.beginPath();
    ctx.arc(-width * 0.3, -height * 0.33, height * 0.21, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.3, -height * 0.33, height * 0.21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.44, height * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.light;
    ctx.beginPath();
    ctx.ellipse(0, height * 0.22, width * 0.2, height * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a1d';
    ctx.beginPath();
    ctx.ellipse(0, height * 0.14, width * 0.06, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const eye of [-0.19, 0.19]) {
      ctx.beginPath();
      ctx.arc(width * eye, -height * 0.08, height * 0.055, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.rotate(-jitter.tilt);
  numberBadge(ctx, number, height);
  ctx.restore();
}

/**
 * A carrot, not a berry. A rabbit running at a carrot explains itself; three
 * red circles in the grass explained nothing, and a reward nobody understands
 * is just something confusing in the way.
 */
export function drawBerry(ctx: CanvasRenderingContext2D, at: Point): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  // Smaller than an obstacle — it is a treat, not a wall — but big enough to be
  // spotted a lane away and decided about.
  ctx.scale(1.4, 1.4);

  // A glow, so it reads as something to want rather than something to avoid.
  ctx.fillStyle = 'rgba(255,214,102,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();

  // Leaves.
  ctx.fillStyle = '#4e9a51';
  for (const lean of [-0.5, 0, 0.5]) {
    ctx.save();
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.ellipse(0, -34, 7, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The root: a tapering triangle, with the ridges a carrot has.
  ctx.fillStyle = '#ef8034';
  ctx.beginPath();
  ctx.moveTo(-15, -20);
  ctx.lineTo(15, -20);
  ctx.lineTo(0, 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,80,20,0.55)';
  ctx.lineWidth = 2;
  for (const y of [-8, 4]) {
    ctx.beginPath();
    ctx.moveTo(-9 + y * 0.12, y);
    ctx.lineTo(9 - y * 0.12, y - 3);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRabbit(
  ctx: CanvasRenderingContext2D,
  x: number,
  options: { sum: string; stumbling: boolean; bob: number },
): void {
  const at = pathPoint(x, 1);
  const { rabbitWidth: w, rabbitHeight: h } = PATH;

  ctx.save();
  ctx.translate(at.x, at.y + Math.sin(options.bob * Math.PI * 2) * 5);
  if (options.stumbling) ctx.rotate(Math.sin(options.bob * 18) * 0.28);

  ctx.fillStyle = '#f4f1ea';
  // Ears first, so the body sits over them.
  ctx.beginPath();
  ctx.ellipse(-w * 0.16, -h * 0.52, w * 0.09, h * 0.26, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.16, -h * 0.52, w * 0.09, h * 0.26, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.34, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // A tail and an eye, which is all a rabbit needs to read as one.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, h * 0.3, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(w * 0.12, -h * 0.06, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The sum rides on a sign above the rabbit, clear of its body — the lesson
  // from Sky Patrol, where the fighter's own nose covered the operator.
  const signWidth = Math.max(160, options.sum.length * 28);
  // Clear of the ears, which reach about 0.78 of its height above it.
  const signY = at.y - h * 1.18;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = options.stumbling ? '#e8543f' : '#3f8f52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect?.(at.x - signWidth / 2, signY - 28, signWidth, 56, 16);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.stumbling ? '#b52d17' : '#1e2a38';
  ctx.fillText(options.sum, at.x, signY);
  ctx.restore();
}

/** Leaves flying where an obstacle burst. */
export function drawBurst(ctx: CanvasRenderingContext2D, at: Point, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = '#7bbf5a';
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = 20 + progress * 70;
    ctx.beginPath();
    ctx.ellipse(
      at.x + Math.cos(angle) * distance,
      at.y + Math.sin(angle) * distance,
      11,
      6,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
