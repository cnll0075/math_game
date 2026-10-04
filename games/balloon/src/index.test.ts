// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { balloonGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

describe('balloonGame', () => {
  it('names itself for the catalog', () => {
    expect(balloonGame.id).toBe('balloon');
    expect(balloonGame.title).toBe('Balloon Rescue');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await balloonGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
