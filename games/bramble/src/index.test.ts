// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { brambleGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

describe('brambleGame', () => {
  it('names itself for the catalog', () => {
    expect(brambleGame.id).toBe('bramble');
    expect(brambleGame.title).toBe('Bramble Dash');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await brambleGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
