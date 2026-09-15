import { ANIMALS, type AnimalId } from '../logic/animals.js';
import type { AnimalArtist, AnimalPose, Expression } from './theme.js';
import { hand } from './type.js';

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
  if (expression === 'cheer') {
    // Happy closed eyes: two upward arcs.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * spread, y + 2, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    return;
  }
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
  if (expression === 'cheer') {
    // A wide open grin.
    ctx.arc(0, y - 4, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8.5, y - 1);
    ctx.lineTo(8.5, y - 1);
  } else if (expression === 'calm') {
    // A small smile.
    ctx.arc(0, y - 3, 6, 0.25 * Math.PI, 0.75 * Math.PI);
  } else if (expression === 'surprised') {
    ctx.ellipse(0, y, 4, 5, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, y, 6.5, 7.5, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
};

const drawChicken = (ctx: CanvasRenderingContext2D, pose: AnimalPose): void => {
  const { body, accent, belly } = ANIMALS.chicken.palette;

  // Tail feathers, fanned out behind.
  ctx.save();
  ctx.translate(-16, -4);
  ctx.rotate(-0.3 + pose.wobble * 0.2);
  for (const lean of [-0.35, 0, 0.35]) {
    ctx.save();
    ctx.rotate(lean);
    ellipse(ctx, -8, -8, 5, 15, body);
    ctx.restore();
  }
  ctx.restore();

  // Comb: three little peaks, the giveaway silhouette.
  for (const offset of [-7, 0, 7]) {
    ellipse(ctx, offset * 0.7, -26 + Math.abs(offset) * 0.25, 5, 7, accent);
  }

  ellipse(ctx, 0, 0, 19, 20, body);
  ellipse(ctx, 0, 7, 12, 12, belly);

  // Beak, pointing the way the chicken faces.
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(29, 4);
  ctx.lineTo(17, 8);
  ctx.closePath();
  ctx.fillStyle = '#f2b33d';
  ctx.fill();

  // Wattle, under the beak.
  ellipse(ctx, 15, 11, 4, 6, accent);

  drawEyes(ctx, 7, -4, pose.expression);
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
  chicken: drawChicken,
  cat: drawCat,
  dog: drawDog,
  bear: drawBear,
};

/**
 * Where each species wears its weight tag, clear of the face and of the body's
 * silhouette edge.
 */
const BADGE_POS: Record<AnimalId, { x: number; y: number }> = {
  chicken: { x: 14, y: 16 },
  cat: { x: 18, y: 16 },
  dog: { x: 23, y: 15 },
  bear: { x: 29, y: 20 },
};

const BADGE_RADIUS = 13;

/**
 * The smallest an animal can be drawn before its weight tag stops shrinking
 * with it. A child should never have to remember what a cat weighs, so the tag
 * stays readable even on the small animals inside a group.
 */
export const BADGE_MIN_SCALE = 0.62;

/**
 * The animal's weight, worn as a tag. Drawn inside the animal's own transform
 * so it tips and hops with the animal and reads as part of it rather than as
 * an overlay.
 */
/** How big a weight is written, before a crowded animal's relief scaling. */
const BADGE_SIZE = 34;

/**
 * A colour per weight, held to everywhere a number appears. The animals each
 * weigh a fixed amount, so this is a colour per animal as well, and a child who
 * cannot yet read the numeral still sees that two cats and a blue three are
 * different amounts of animal.
 */
const WEIGHT_COLOUR: Record<number, string> = {
  1: '#f2a516',
  2: '#f2702a',
  3: '#3d8ee0',
  5: '#9b5de5',
};

export const drawWeightBadge = (
  ctx: CanvasRenderingContext2D,
  species: AnimalId,
  drawnAt: number,
  at: { x: number; y: number } = BADGE_POS[species],
): void => {
  const { x, y } = at;
  const weight = ANIMALS[species].weight;
  // Counter the animal's own shrinking, so the number stays legible in a group.
  const relief = Math.max(1, BADGE_MIN_SCALE / drawnAt);
  const label = String(weight);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(relief, relief);
  // A shade off square, the way a number gets written by hand.
  ctx.rotate(-0.07);
  ctx.font = hand(700, BADGE_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Three passes outward in: a dark edge to sit it on the park, a white rim to
  // hold it off whatever is behind, and the number itself in its own colour.
  // Each weight keeps its colour wherever it appears, so a child can find the
  // threes without reading them.
  ctx.shadowColor = 'rgba(24, 38, 24, 0.38)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  ctx.lineWidth = 11;
  ctx.strokeStyle = 'rgba(34, 46, 38, 0.55)';
  ctx.strokeText(label, 0, 0);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(label, 0, 0);

  ctx.fillStyle = WEIGHT_COLOUR[weight] ?? '#f2702a';
  ctx.fillText(label, 0, 0);
  ctx.restore();
};

/**
 * How far each species' lowest point sits below its drawing origin. A pose
 * positions an animal's FEET, so each body is lifted by its own height and the
 * animals stand on the plank instead of sinking halfway through it.
 */
const FOOT_OFFSET: Record<AnimalId, number> = {
  chicken: 21,
  cat: 24,
  dog: 25,
  bear: 33,
};

/** Half the height of the tallest animal, for hit testing a placed animal. */
export const ANIMAL_HIT_LIFT = 26;

/** How high a dancing animal hops, in local units. */
const HOP_HEIGHT = 26;

/**
 * How each species moves while it travels to its place. A chicken beats its
 * wings and bobs; a cat pours along in a low fast arc; a dog trots with a bounce
 * per step; a bear lumbers and rolls. Same journey, four characters.
 */
interface Gait {
  /** Height of the travelling arc, in local units. */
  arc: number;
  /** How many times it bobs on the way. */
  bobs: number;
  /** How far it leans into the run, in radians. */
  lean: number;
  /** How much it squashes on landing. */
  land: number;
}

const GAITS: Record<AnimalId, Gait> = {
  chicken: { arc: 96, bobs: 7, lean: 0.12, land: 0.1 },
  cat: { arc: 54, bobs: 3, lean: 0.3, land: 0.16 },
  dog: { arc: 44, bobs: 4, lean: 0.22, land: 0.2 },
  bear: { arc: 22, bobs: 2, lean: 0.1, land: 0.26 },
};

/** Wings, legs and ears, moving because the animal is moving. */
const drawMotion = (ctx: CanvasRenderingContext2D, species: AnimalId, effort: number, clock: number): void => {
  if (effort <= 0.01) return;
  const beat = Math.sin(clock * (species === 'chicken' ? 26 : 18));

  if (species === 'chicken') {
    // Wings, beating hard enough to explain the height.
    ctx.save();
    ctx.globalAlpha = effort;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 12, -2);
      ctx.rotate(side * (0.5 + beat * 0.7));
      ctx.beginPath();
      ctx.ellipse(side * 10, 0, 16, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(29,43,50,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // Legs, reaching out in front and behind.
  ctx.save();
  ctx.globalAlpha = effort;
  ctx.strokeStyle = 'rgba(29,43,50,0.55)';
  ctx.lineWidth = species === 'bear' ? 7 : 5;
  ctx.lineCap = 'round';
  for (const [side, phase] of [
    [-1, beat],
    [1, -beat],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(side * 9, 14);
    ctx.lineTo(side * 9 + phase * 11, 26);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * The motion every animal shares, whatever it is drawn with: the hop of a
 * dance, the arc of an arrival, the lean, the squash on landing, the breathing.
 * Runs the given drawing inside that transform.
 */
/**
 * How big each painted animal is drawn on the plank, at a pose scale of one.
 * Heights come from the artwork's own proportions, so the bear still looks like
 * five chickens' worth of animal; the aspect is the picture file's own, which
 * is what decides whether a row of them fits in a basket.
 */
export const ANIMAL_ART: Record<AnimalId, { height: number; aspect: number }> = {
  chicken: { height: 104, aspect: 0.971 },
  cat: { height: 130, aspect: 0.948 },
  dog: { height: 166, aspect: 0.994 },
  bear: { height: 187, aspect: 1.086 },
};

export function withPose(
  ctx: CanvasRenderingContext2D,
  species: AnimalId,
  pose: AnimalPose,
  draw: (travelling: number) => void,
): void {
  const gait = GAITS[species];

  // One hop arc per unit of dance: up, over, down, landing back on the plank.
  const hop = pose.dance > 0 ? Math.abs(Math.sin(pose.dance * Math.PI * 3)) * HOP_HEIGHT : 0;
  const spin = pose.dance > 0 ? Math.sin(pose.dance * Math.PI * 6) * 0.22 : 0;

  // Travelling: a long arc with the species' own bobbing on top of it, and a
  // squash at the end as the weight lands.
  const travelling = pose.arriving > 0 && pose.arriving < 1;
  const arc = travelling ? Math.sin(pose.arriving * Math.PI) * gait.arc : 0;
  const bob = travelling ? Math.sin(pose.arriving * Math.PI * gait.bobs) * 5 : 0;
  const lean = travelling ? Math.sin(pose.arriving * Math.PI) * gait.lean * pose.facing : 0;
  const landing = pose.arriving > 0.82 && pose.arriving < 1 ? (pose.arriving - 0.82) / 0.18 : 0;

  // Idling: breathing, always, so nothing on the plank looks like furniture.
  const breath = Math.sin(pose.clock * 1.8 + pose.x * 0.03) * 0.012;

  const squash =
    (pose.dance > 0 ? 1 + (hop / HOP_HEIGHT) * 0.08 : 1) *
    (1 - Math.sin(landing * Math.PI) * gait.land) *
    (1 - breath);

  ctx.save();
  ctx.translate(pose.x + pose.slide, pose.y - hop - arc - bob);
  ctx.rotate(pose.tiltRad + pose.wobble * 0.08 + spin + lean);
  ctx.scale(pose.scale, pose.scale);
  ctx.scale(
    (1 + Math.abs(pose.wobble) * 0.04) / squash,
    (1 - Math.abs(pose.wobble) * 0.04) * squash,
  );
  draw(travelling ? 1 - landing : 0);
  ctx.restore();
}

export const vectorAnimalArtist: AnimalArtist = {
  draw(ctx, species, pose) {
    const gait = GAITS[species];

    // One hop arc per unit of dance: up, over, down, landing back on the plank.
    const hop = pose.dance > 0 ? Math.abs(Math.sin(pose.dance * Math.PI * 3)) * HOP_HEIGHT : 0;
    const spin = pose.dance > 0 ? Math.sin(pose.dance * Math.PI * 6) * 0.22 : 0;

    // Travelling: a long arc with the species' own bobbing on top of it, and a
    // squash at the end as the weight lands.
    const travelling = pose.arriving > 0 && pose.arriving < 1;
    const arc = travelling ? Math.sin(pose.arriving * Math.PI) * gait.arc : 0;
    const bob = travelling ? Math.sin(pose.arriving * Math.PI * gait.bobs) * 5 : 0;
    const lean = travelling ? Math.sin(pose.arriving * Math.PI) * gait.lean : 0;
    const landing = pose.arriving > 0.82 && pose.arriving < 1 ? (pose.arriving - 0.82) / 0.18 : 0;

    // Idling: breathing, always, so nothing on the plank looks like furniture.
    const breath = Math.sin(pose.clock * 1.8 + pose.x * 0.03) * 0.012;

    const squash =
      (pose.dance > 0 ? 1 + (hop / HOP_HEIGHT) * 0.08 : 1) *
      (1 - Math.sin(landing * Math.PI) * gait.land) *
      (1 - breath);

    ctx.save();
    ctx.translate(pose.x + pose.slide, pose.y - hop - arc - bob);
    ctx.rotate(pose.tiltRad + pose.wobble * 0.08 + spin + lean);
    ctx.scale(pose.scale, pose.scale);
    ctx.scale(
      (1 + Math.abs(pose.wobble) * 0.04) / squash,
      (1 - Math.abs(pose.wobble) * 0.04) * squash,
    );
    ctx.translate(0, -FOOT_OFFSET[species]);
    drawMotion(ctx, species, travelling ? 1 - landing : 0, pose.clock);
    PAINTERS[species](ctx, pose);
    ctx.restore();
  },

  drawTag(ctx, species, pose) {
    withPose(ctx, species, pose, () => {
      ctx.translate(0, -FOOT_OFFSET[species]);
      drawWeightBadge(ctx, species, pose.scale);
    });
  },
};
