import { describe, it, expect } from 'vitest';
import { recordingContext } from '@bundle/core';
import { createDriver } from '../driver.js';
import { sumText } from '../logic/equation.js';
import { createScene, type Scene } from './scene.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

/**
 * Plays a real run, hands off nothing, and stops on the frame a plane gets
 * away. Written end to end on purpose: the first version of this feedback was
 * wired correctly and still unreadable, because a new question arrived on the
 * same frame and nothing tied the heart to the sum it was lost on.
 */
const untilALossHappens = (seed: number) => {
  const driver = createDriver({ best: 0, seed });
  const scene = createScene();
  for (let i = 0; i < 60 * 60; i += 1) {
    const events = driver.step(FRAME);
    scene.observe(events);
    scene.update(FRAME, driver.model());
    const escape = events.find((event) => event.type === 'escaped');
    if (escape?.type === 'escaped') {
      return { driver, scene, missed: `${sumText(escape.sum)} = ${escape.sum.answer}` };
    }
  }
  throw new Error('no plane ever got away');
};

const frameOf = (scene: Scene): string[] => {
  const { ctx, texts } = recordingContext();
  scene.render(ctx, SCREEN);
  return texts;
};

describe('losing a heart', () => {
  it('says what got away, in the middle of the screen where the player is looking', () => {
    const { scene, missed } = untilALossHappens(3);
    const texts = frameOf(scene);
    expect(texts).toContain('It got away!');
    expect(texts).toContain(missed);
  });

  it('holds the question instead of replacing it in the same breath', () => {
    const { driver, scene, missed } = untilALossHappens(3);
    // Half a second on, the sum that cost the heart is still the one on show.
    for (let i = 0; i < 30; i += 1) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    expect(frameOf(scene)).toContain(missed);
    expect(driver.state.sum).toBeNull();
  });

  it('gets back to a live question once the beat is over', () => {
    const { driver, scene, missed } = untilALossHappens(3);
    for (let i = 0; i < 60 * 3; i += 1) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    expect(driver.state.mourning).toBe(0);
    expect(driver.state.sum).not.toBeNull();
    const texts = frameOf(scene);
    expect(texts).not.toContain('It got away!');
    expect(texts).not.toContain(missed);
  });
});
