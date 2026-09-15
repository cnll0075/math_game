import { ANIMAL_IDS, type AnimalId } from '../logic/animals.js';
import { ANIMAL_ART, drawWeightBadge, vectorAnimalArtist, withPose } from './animals-art.js';
import { createVectorTheme } from './vector-theme.js';
import { PARK, PARK_SCALE, SCENE } from './geometry.js';
import type { AnimalArtist, AnimalPose, SeesawTheme } from './theme.js';

import parkUrl from '../../assets/park.jpg';
import plankBackUrl from '../../assets/plank-back.png';
import plankFrontUrl from '../../assets/plank-front.png';
import fulcrumUrl from '../../assets/fulcrum.png';
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
        const height = ANIMAL_ART[species].height;
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
      const height = ANIMAL_ART[species].height;
      const width = (image.width / image.height) * height;
      // Outside the flip, so the number never reads mirrored; and high enough
      // on the animal to clear the basket wall it is riding behind.
      withPose(ctx, species, pose, () => {
        drawWeightBadge(ctx, species, pose.scale, { x: width * 0.34, y: -height * 0.52 });
      });
    },
  };
}

/**
 * Everything cut out of the painting is on one canvas with the bolt at the same
 * spot, so all three pieces share a single transform and none of them can slip
 * out of line with the others.
 */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  angle: number | null,
): void {
  const { sprite } = PARK;
  ctx.save();
  ctx.translate(SCENE.fulcrumX, SCENE.fulcrumY);
  if (angle !== null) ctx.rotate(angle);
  ctx.drawImage(
    image,
    -sprite.pivotX * PARK_SCALE,
    -sprite.pivotY * PARK_SCALE,
    sprite.width * PARK_SCALE,
    sprite.height * PARK_SCALE,
  );
  ctx.restore();
}

/** The painted park, with its own seesaw lifted out so ours can tilt. */
export function createSpriteTheme(): SeesawTheme {
  const base = createVectorTheme();
  const animals = createSpriteAnimalArtist();
  const parts = new Map<string, HTMLImageElement>();
  const part = (name: string): HTMLImageElement | null => parts.get(name) ?? null;

  return {
    ...base,
    animals,

    drawBackground(ctx, view) {
      const park = part('park');
      if (!park) {
        base.drawBackground(ctx, view);
        return;
      }
      const { bounds } = view;
      const width = PARK.width * PARK_SCALE;
      const height = (PARK.height + PARK.skyHeadroom) * PARK_SCALE;
      const left = SCENE.fulcrumX - PARK.pivotX * PARK_SCALE;
      // The painting stands on the same ground line the seesaw stands on.
      const top = SCENE.groundY - (PARK.groundY + PARK.skyHeadroom) * PARK_SCALE;

      // The backdrop is cut with sky above the painting, so it reaches past the
      // top of any screen this runs on. Taller still than that, and its topmost
      // row carries on upward - which is safe now that the row is plain sky.
      const edge = 2;
      if (top > bounds.top) {
        ctx.drawImage(park, 0, 0, park.width, edge, left, bounds.top, width, top - bounds.top + 1);
      }
      if (top + height < bounds.bottom) {
        // Grass below comes from one column of the bottom edge, not the whole
        // row: the row crosses rocks and flowers, and stretching those downward
        // smeared them into streaks.
        const column = Math.round(park.width * 0.42);
        ctx.drawImage(
          park, column, park.height - edge, 1, edge,
          bounds.left, top + height - 1, bounds.right - bounds.left, bounds.bottom - top - height + 1,
        );
      }
      ctx.drawImage(park, left, top, width, height);
    },

    drawSeesaw(ctx, view) {
      const plank = part('plank-back');
      const fulcrum = part('fulcrum');
      if (!plank || !fulcrum) {
        base.drawSeesaw(ctx, view);
        return;
      }
      drawSprite(ctx, plank, view.plankAngle);
      // The post is painted in front of the plank, which is what hides the
      // middle of the board and the seam where it turns.
      drawSprite(ctx, fulcrum, null);
    },

    drawSeesawFront(ctx, view) {
      const front = part('plank-front');
      if (front) drawSprite(ctx, front, view.plankAngle);
    },

    async preload() {
      const pieces: [string, string][] = [
        ['park', parkUrl],
        ['plank-back', plankBackUrl],
        ['plank-front', plankFrontUrl],
        ['fulcrum', fulcrumUrl],
      ];
      await Promise.all([
        base.preload(),
        animals.preload(),
        afterAtMost(
          Promise.all(
            pieces.map(async ([name, url]) => {
              const image = await loadImage(url);
              if (image) parts.set(name, image);
            }),
          ),
          PATIENCE_MS,
        ),
      ]);
    },
  };
}
