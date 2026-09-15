import { ANIMAL_IDS, type AnimalId } from '../logic/animals.js';
import { drawWeightBadge, vectorAnimalArtist, withPose } from './animals-art.js';
import { createVectorTheme } from './vector-theme.js';
import type { AnimalArtist, AnimalPose, SeesawTheme } from './theme.js';

import chickenUrl from '../../assets/chicken.png';
import catUrl from '../../assets/cat.png';
import dogUrl from '../../assets/dog.png';
import bearUrl from '../../assets/bear.png';

const SOURCES: Record<AnimalId, string> = {
  chicken: chickenUrl,
  cat: catUrl,
  dog: dogUrl,
  bear: bearUrl,
};

/**
 * How tall each animal stands, in design units, at a pose scale of one. Taken
 * from the artwork's own proportions, so the bear still looks like five
 * chickens' worth of animal.
 */
const HEIGHTS: Record<AnimalId, number> = {
  chicken: 70,
  cat: 88,
  dog: 112,
  bear: 126,
};

/**
 * How long the game waits for the pictures before starting without them. It
 * starts either way: a slow or missing file must never hold up a child, and the
 * drawn animals stand in until the painted ones are ready.
 */
const PATIENCE_MS = 250;

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const afterAtMost = <T>(work: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/** A mark over an animal that has no face to pull: worry, and delight. */
function drawMood(ctx: CanvasRenderingContext2D, pose: AnimalPose, top: number): void {
  if (pose.dance > 0) {
    // Sparkles, on the beat of the hop.
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    for (const [side, phase] of [
      [-1, 0],
      [1, Math.PI / 2],
    ] as const) {
      const twinkle = 0.6 + Math.sin(pose.clock * 9 + phase) * 0.4;
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(side * 26, top - 10 - twinkle * 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (pose.expression !== 'alarmed') return;
  // The art has one face, so alarm is shown above the animal rather than on it.
  ctx.save();
  ctx.translate(20 * pose.facing, top - 14 + Math.sin(pose.clock * 12) * 2);
  ctx.fillStyle = '#e4695f';
  ctx.beginPath();
  ctx.roundRect?.(-7, -18, 14, 22, 6);
  if (!ctx.roundRect) ctx.rect(-7, -18, 14, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, -7);
  ctx.restore();
}

/**
 * The painted animals. Everything else about them is unchanged: they travel in
 * with the same gaits, wobble on the same tilt, and carry the same weight tag,
 * because all of that lives in the pose rather than in the drawing.
 */
export function createSpriteAnimalArtist(): AnimalArtist & { preload(): Promise<void> } {
  const images = new Map<AnimalId, HTMLImageElement>();

  return {
    async preload() {
      // Each picture drops in as it arrives, whether or not the wait is over.
      const all = ANIMAL_IDS.map(async (id) => {
        const image = await loadImage(SOURCES[id]);
        if (image) images.set(id, image);
      });
      await afterAtMost(Promise.all(all), PATIENCE_MS);
    },

    draw(ctx, species, pose) {
      const image = images.get(species);
      if (!image) {
        // No picture yet, or none at all: the drawn animal stands in, so the
        // game is playable before the art arrives and if it never does.
        vectorAnimalArtist.draw(ctx, species, pose);
        return;
      }

      withPose(ctx, species, pose, () => {
        const height = HEIGHTS[species];
        const width = (image.width / image.height) * height;
        ctx.save();
        // Animals look towards the middle of the seesaw.
        ctx.scale(pose.facing, 1);
        ctx.drawImage(image, -width / 2, -height, width, height);
        ctx.restore();
        drawMood(ctx, pose, -height);
      });
    },

    drawTag(ctx, species, pose) {
      const image = images.get(species);
      if (!image) {
        vectorAnimalArtist.drawTag(ctx, species, pose);
        return;
      }
      const height = HEIGHTS[species];
      const width = (image.width / image.height) * height;
      // Outside the flip, so the number never reads mirrored.
      withPose(ctx, species, pose, () => {
        drawWeightBadge(ctx, species, pose.scale, { x: width * 0.32, y: -height * 0.18 });
      });
    },
  };
}

/** The park, with painted animals in it. */
export function createSpriteTheme(): SeesawTheme {
  const base = createVectorTheme();
  const animals = createSpriteAnimalArtist();

  return {
    ...base,
    animals,
    async preload() {
      await Promise.all([base.preload(), animals.preload()]);
    },
  };
}
