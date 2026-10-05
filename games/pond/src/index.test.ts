// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { pondGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

describe('pondGame', () => {
  it('names itself for the catalog', () => {
    expect(pondGame.id).toBe('pond');
    expect(pondGame.title).toBe('Pond Pairs');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await pondGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
