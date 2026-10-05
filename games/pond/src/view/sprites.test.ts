import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('starts with nothing loaded and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    expect(sprites).toEqual({ pond: null, pad: null, frog: null });
  });
});
