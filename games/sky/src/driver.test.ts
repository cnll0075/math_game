import { describe, it, expect } from 'vitest';
import { createDriver } from './driver.js';

const FRAME = 1 / 60;

describe('the driver', () => {
  it('hands the scene a question already written out', () => {
    const driver = createDriver({ best: 0, seed: 1 });
    driver.step(FRAME);
    const model = driver.model();
    expect(model.sumText).toMatch(/^\d+ [+−] \d+$/);
    expect(model.summary).toBeNull();
    expect(model.run.aloft.length).toBeGreaterThan(0);
  });

  it('holds a summary once the run is over, and reports a new best', () => {
    const driver = createDriver({ best: 0, seed: 2, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    expect(driver.summary).not.toBeNull();
    expect(driver.summary!.beatenBest).toBe(driver.state.score > 0);
    expect(driver.summary!.seconds).toBeGreaterThan(0);
  });

  it('does not claim a new best when the old one stands', () => {
    const driver = createDriver({ best: 9999, seed: 3, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.summary!.beatenBest).toBe(false);
    expect(driver.summary!.best).toBe(9999);
  });

  it('starts a clean run when asked to go again', () => {
    const driver = createDriver({ best: 0, seed: 4, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    driver.restart();
    driver.step(FRAME);
    expect(driver.state.status).toBe('flying');
    expect(driver.state.score).toBe(0);
    expect(driver.state.hearts).toBe(1);
    expect(driver.summary).toBeNull();
  });

  it('counts time flown from where the band opened, not from zero', () => {
    const driver = createDriver({ best: 0, seed: 5, hearts: 1, startBand: 'take-aways' });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    // Opening at 2:00 must not report two free minutes of flying.
    expect(driver.summary!.seconds).toBeLessThan(120);
  });

  it('opens at a band when told to', () => {
    const driver = createDriver({ best: 0, startBand: 'over-ten' });
    driver.step(FRAME);
    expect(driver.state.band.id).toBe('over-ten');
  });

  it('ignores a band id that means nothing', () => {
    const driver = createDriver({ best: 0, startBand: 'nonsense' });
    driver.step(FRAME);
    expect(driver.state.band.id).toBe('easy');
  });
});
