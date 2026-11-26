import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('knows every picture cut from the sheet, and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    for (const name of ['backdrop', 'sign', 'train-red', 'train-blue', 'train-green', 'cargo-1', 'cargo-10', 'worker-wrench', 'broken-track', 'star', 'bolt', 'signal']) {
      expect(sprites).toHaveProperty(name, null);
    }
  });
});
