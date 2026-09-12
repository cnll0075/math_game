import { ANIMALS, type AnimalId } from '../logic/animals.js';
import type { AnimalArtist, AnimalPose, Expression } from './theme.js';

/**
 * Prototype animal art, drawn from primitives so the game needs no image
 * assets. Each species is built for a distinct silhouette at a glance: the
 * rabbit is small with tall ears, the cat medium with a curled tail, the dog
 * square-snouted, the bear a big round mass. Replace this file wholesale when
 * real art arrives; nothing outside it knows how an animal is drawn.
 */

const EYE_WHITE = '#ffffff';
const INK = '#3a2f2a';

const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
};

const drawEyes = (ctx: CanvasRenderingContext2D, spread: number, y: number, expression: Expression): void => {
  const radius = expression === 'alarmed' ? 6.5 : expression === 'surprised' ? 5.5 : 4.5;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * spread, y, radius, radius, EYE_WHITE);
    const pupilOffset = expression === 'alarmed' ? 1.6 : 0;
    ellipse(ctx, side * spread + pupilOffset, y + pupilOffset, radius * 0.55, radius * 0.55, INK);
  }
};

const drawMouth = (ctx: CanvasRenderingContext2D, y: number, expression: Expression): void => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (expression === 'calm') {
    // A small smile.
    ctx.arc(0, y - 3, 6, 0.25 * Math.PI, 0.75 * Math.PI);
  } else if (expression === 'surprised') {
    ctx.ellipse(0, y, 4, 5, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, y, 6.5, 7.5, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
};

const drawRabbit = (ctx: CanvasRenderingContext2D, pose: AnimalPose): void => {
  const { body, accent, belly } = ANIMALS.rabbit.palette;
  // Ears first so the head overlaps their base.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 7, -30);
    ctx.rotate(side * (0.16 + pose.wobble * 0.12));
    ellipse(ctx, 0, 0, 6, 22, body);
    ellipse(ctx, 0, 2, 3, 15, accent);
    ctx.restore();
  }
  ellipse(ctx, 0, 2, 20, 19, body);
  ellipse(ctx, 0, 8, 12, 11, belly);
  ellipse(ctx, 22, 8, 7, 7, body);
  drawEyes(ctx, 7, -2, pose.expression);
  drawMouth(ctx, 10, pose.expression);
};

const drawCat = (ctx: CanvasRenderingContext2D, pose: AnimalPose): void => {
  const { body, accent, belly } = ANIMALS.cat.palette;
  // Tail curls opposite the sway, which reads as the cat counterbalancing.
  ctx.save();
  ctx.translate(24, 6);
  ctx.rotate(-pose.wobble * 0.5);
  ctx.strokeStyle = body;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(18, -6, 12, -26);
  ctx.stroke();
  ctx.restore();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, -22);
    ctx.lineTo(side * 20, -34);
    ctx.lineTo(side * 21, -17);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * 11, -22);
    ctx.lineTo(side * 18, -30);
    ctx.lineTo(side * 18, -19);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ellipse(ctx, 0, 2, 24, 22, body);
  ellipse(ctx, 0, 9, 14, 12, belly);
  drawEyes(ctx, 9, -2, pose.expression);
  drawMouth(ctx, 11, pose.expression);
};

const drawDog = (ctx: CanvasRenderingContext2D, pose: AnimalPose): void => {
  const { body, accent, belly } = ANIMALS.dog.palette;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 22, -12);
    ctx.rotate(side * (0.3 + pose.wobble * 0.2));
    ellipse(ctx, 0, 8, 9, 18, accent);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, 28, 25, body);
  ellipse(ctx, 0, 10, 17, 14, belly);
  // Square snout: the silhouette cue that separates dog from cat.
  ctx.fillStyle = belly;
  ctx.fillRect(-13, 6, 26, 17);
  ctx.fillStyle = INK;
  ctx.fillRect(-4, 8, 8, 6);
  drawEyes(ctx, 10, -6, pose.expression);
  drawMouth(ctx, 20, pose.expression);
};

const drawBear = (ctx: CanvasRenderingContext2D, pose: AnimalPose): void => {
  const { body, accent, belly } = ANIMALS.bear.palette;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 24, -26, 11, 11, body);
    ellipse(ctx, side * 24, -26, 6, 6, accent);
  }
  ellipse(ctx, 0, 0, 36, 33, body);
  ellipse(ctx, 0, 10, 22, 19, belly);
  ellipse(ctx, 0, 14, 12, 9, accent);
  ctx.fillStyle = INK;
  ellipse(ctx, 0, 9, 5, 4, INK);
  drawEyes(ctx, 13, -6, pose.expression);
  drawMouth(ctx, 20, pose.expression);
  // A paw grips the plank once things get alarming.
  if (pose.expression === 'alarmed') {
    ellipse(ctx, -30, 26, 9, 7, body);
    ellipse(ctx, 30, 26, 9, 7, body);
  }
};

const PAINTERS: Record<AnimalId, (ctx: CanvasRenderingContext2D, pose: AnimalPose) => void> = {
  rabbit: drawRabbit,
  cat: drawCat,
  dog: drawDog,
  bear: drawBear,
};

export const vectorAnimalArtist: AnimalArtist = {
  draw(ctx, species, pose) {
    ctx.save();
    ctx.translate(pose.x + pose.slide, pose.y);
    ctx.rotate(pose.tiltRad + pose.wobble * 0.08);
    ctx.scale(pose.scale, pose.scale);
    // Squash slightly on the downhill lean so the weight reads physically.
    ctx.scale(1 + Math.abs(pose.wobble) * 0.04, 1 - Math.abs(pose.wobble) * 0.04);
    PAINTERS[species](ctx, pose);
    ctx.restore();
  },
};
