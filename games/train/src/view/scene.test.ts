import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { COACH_LINE, createScene, previewText } from './scene.js';
import { NO_SPRITES } from './sprites.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, seconds = FRAME, drag?: { crate: number; at: { x: number; y: number } }) => {
  const scene = createScene(NO_SPRITES);
  for (let t = 0; t < seconds; t += FRAME) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  if (drag) scene.drag(drag.crate, drag.at);
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws every sign, every crate number, the clock, trains sent and the coach', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    const { ctx, texts } = render(driver, 3.2);
    expect(depthOf(ctx)).toBe(0);
    for (const track of driver.run.state.tracks) expect(texts).toContain(`0 / ${track.target}`);
    for (const crate of driver.run.state.queue) expect(texts).toContain(String(crate.weight));
    expect(texts).toContain('0:03');
    expect(texts).toContain('0');
    expect(texts).toContain(COACH_LINE);
  });

  it('previews a held crate on the train under it', () => {
    expect(previewText(7, 3, 10)).toEqual({ text: '7 + 3 = 10', tone: 'exact' });
    expect(previewText(2, 3, 10)).toEqual({ text: '2 + 3 = 5', tone: 'under' });
    expect(previewText(8, 3, 10)).toEqual({ text: '8 + 3 = 11', tone: 'over' });
    const driver = createDriver({ best: 0, seed: () => 2 });
    render(driver, 3);
    const crate = driver.run.state.queue[0]!;
    const { texts } = render(driver, FRAME, { crate: crate.id, at: { x: 700, y: 260 } });
    expect(texts).toContain(`0 + ${crate.weight} = ${crate.weight}`);
  });

  it('shows the summary when the run is over, balanced and readable', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    const { ctx, texts } = render(driver, 70);
    expect(driver.phase).toBe('over');
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('Tap to go again');
    expect(texts.some((text) => text.startsWith('Trains sent'))).toBe(true);
  });

  it('shows the pause card while paused', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    render(driver, 1);
    driver.act({ kind: 'pause' });
    const { texts } = render(driver, FRAME);
    expect(texts).toContain('Paused');
  });
});
