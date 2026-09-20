import { hand, label, type Point } from '@bundle/core';
import { LANES } from '../logic/lanes.js';
import type { ObstacleKind } from '../logic/row.js';
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

const OBSTACLE_SKIN: Record<ObstacleKind, { body: string; trim: string }> = {
  rock: { body: '#b9bec6', trim: '#7d848d' },
  bear: { body: '#a9754c', trim: '#6f4726' },
  log: { body: '#c08b5c', trim: '#8a5c33' },
};

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  at: Point,
  kind: ObstacleKind,
  number: number,
): void {
  const { width, height } = obstacleSize();
  const skin = OBSTACLE_SKIN[kind];
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = skin.body;

  if (kind === 'rock') {
    ctx.beginPath();
    ctx.moveTo(-width / 2, height / 2);
    ctx.lineTo(-width * 0.34, -height * 0.4);
    ctx.lineTo(width * 0.1, -height / 2);
    ctx.lineTo(width / 2, height * 0.16);
    ctx.lineTo(width * 0.3, height / 2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'log') {
    ctx.beginPath();
    ctx.roundRect?.(-width / 2, -height / 2, width, height, height * 0.4);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.ellipse(-width / 2, 0, height * 0.18, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A bear: a round body and two ears. Cute rather than frightening — it is
    // an obstacle in a child's game, not a threat.
    ctx.beginPath();
    ctx.arc(-width * 0.26, -height * 0.34, height * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.26, -height * 0.34, height * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.ellipse(0, height * 0.2, width * 0.2, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  label(ctx, String(number), 0, 0, height * 0.62, 'center');
  ctx.restore();
}

export function drawBerry(ctx: CanvasRenderingContext2D, at: Point): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = '#3f8f52';
  ctx.fillRect(-3, -30, 6, 16);
  ctx.fillStyle = '#d6335c';
  for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-16, -5, 4, 0, Math.PI * 2);
  ctx.fill();
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
