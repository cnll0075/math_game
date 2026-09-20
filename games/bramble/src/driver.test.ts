import { describe, it, expect } from 'vitest';
import { createDriver } from './driver.js';
import { MISS_COST } from './logic/run.js';

const FRAME = 1 / 60;

describe('the driver', () => {
  it('hands the scene a question already written out', () => {
    const driver = createDriver({ best: 0, seed: 1 });
    driver.step(FRAME);
    const model = driver.model();
    expect(model.sumText).toMatch(/^\d+ [+−] \d+$/);
    expect(model.summary).toBeNull();
    expect(model.run.rows.length).toBeGreaterThan(0);
  });

  it('holds a summary once the tank empties, and reports a new best', () => {
    const driver = createDriver({ best: 0, seed: 2, health: MISS_COST });
    for (let i = 0; i < 60 * 120 && driver.state.status === 'running'; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    expect(driver.summary).not.toBeNull();
    expect(driver.summary!.beatenBest).toBe(driver.state.score > 0);
    expect(driver.summary!.distance).toBeGreaterThan(0);
  });

  it('does not claim a new best when the old one stands', () => {
    const driver = createDriver({ best: 9999, seed: 3, health: MISS_COST });
    for (let i = 0; i < 60 * 120 && driver.state.status === 'running'; i += 1) driver.step(FRAME);
    expect(driver.summary!.beatenBest).toBe(false);
    expect(driver.summary!.best).toBe(9999);
  });

  it('starts a clean run when asked to go again', () => {
    const driver = createDriver({ best: 0, seed: 4, health: MISS_COST });
    for (let i = 0; i < 60 * 120 && driver.state.status === 'running'; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    driver.restart();
    driver.step(FRAME);
    expect(driver.state.status).toBe('running');
    expect(driver.state.score).toBe(0);
    expect(driver.summary).toBeNull();
  });

  it('counts time running from where the band opened, not from zero', () => {
    const driver = createDriver({ best: 0, seed: 5, health: MISS_COST, startBand: 'take-aways' });
    for (let i = 0; i < 60 * 120 && driver.state.status === 'running'; i += 1) driver.step(FRAME);
    expect(driver.summary!.seconds).toBeLessThan(120);
  });

  it('holds the missed sum on the sign through the stumble', () => {
    const driver = createDriver({ best: 0, seed: 6 });
    for (let i = 0; i < 60 * 120; i += 1) {
      driver.step(FRAME);
      if (driver.state.stumble > 0) break;
    }
    expect(driver.state.missed).not.toBeNull();
    expect(driver.model().sumText).toContain('=');
    expect(driver.model().stumbling).toBe(true);
  });

  it('opens at a band when told to, and ignores a name that means nothing', () => {
    const named = createDriver({ best: 0, startBand: 'over-ten' });
    named.step(FRAME);
    expect(named.state.band.id).toBe('over-ten');
    const nonsense = createDriver({ best: 0, startBand: 'nonsense' });
    nonsense.step(FRAME);
    expect(nonsense.state.band.id).toBe('easy');
  });
});
