// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createShell } from './shell.js';
import { CATALOG } from './catalog.js';
import { SOUND_EVENTS } from '@bundle/seesaw';
import { createAudioBus, createContentManifest, createProfileStore, type StorageBackend } from '@bundle/core';
import { installCanvasStub } from '../../../games/seesaw/src/canvas-stub.js';
import { fakeContext } from '../../../packages/core/src/audio/fake-context.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const memoryBackend = (): StorageBackend => {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
};

const testDeps = (unlocked: 'all' | readonly string[] = 'all') => ({
  audio: createAudioBus(() => fakeContext() as unknown as AudioContext),
  profile: createProfileStore(memoryBackend()),
  content: createContentManifest(unlocked),
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('shell launcher', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  it('renders one tile per game in the bundle', () => {
    createShell(root, testDeps()).showLauncher();
    expect(root.querySelectorAll('[data-game-tile]')).toHaveLength(CATALOG.length);
    expect(CATALOG).toHaveLength(10);
  });

  it('marks the nine unbuilt games as coming soon', () => {
    createShell(root, testDeps()).showLauncher();
    expect(root.querySelectorAll('[data-coming-soon]')).toHaveLength(9);
  });

  it('opens the seesaw game from its tile', async () => {
    const shell = createShell(root, testDeps());
    shell.showLauncher();
    root.querySelector<HTMLButtonElement>('[data-game-tile="seesaw"]')!.click();
    await flush();
    expect(root.querySelector('canvas')).not.toBeNull();
    shell.destroy();
  });

  it('returns to the launcher and unmounts the game', async () => {
    const shell = createShell(root, testDeps());
    shell.showLauncher();
    await shell.openGame('seesaw');
    root.querySelector<HTMLButtonElement>('[data-action="back"]')!.click();
    await flush();
    expect(root.querySelector('canvas')).toBeNull();
    expect(root.querySelector('[data-screen="launcher"]')).not.toBeNull();
    shell.destroy();
  });

  it('refuses to open a locked game', async () => {
    const shell = createShell(root, testDeps([]));
    shell.showLauncher();
    const tile = root.querySelector<HTMLButtonElement>('[data-game-tile="seesaw"]')!;
    expect(tile.disabled).toBe(true);
    await shell.openGame('seesaw');
    expect(root.querySelector('canvas')).toBeNull();
  });

  it('ignores an unknown game id', async () => {
    const shell = createShell(root, testDeps());
    shell.showLauncher();
    await shell.openGame('nope');
    expect(root.querySelector('[data-screen="launcher"]')).not.toBeNull();
  });

  it('unlocks audio when a game is opened', async () => {
    const deps = testDeps();
    const shell = createShell(root, deps);
    shell.showLauncher();
    await shell.openGame('seesaw');
    await flush();
    expect(deps.audio.context).not.toBeNull();
    shell.destroy();
  });
});

describe('shell settings', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  it('opens from the launcher', () => {
    createShell(root, testDeps()).showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    expect(root.querySelector('[data-panel="settings"]')).not.toBeNull();
  });

  it('mutes the shared audio bus', () => {
    const deps = testDeps();
    const shell = createShell(root, deps);
    shell.showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    const sound = root.querySelector<HTMLInputElement>('[data-setting="sound"]')!;
    sound.checked = false;
    sound.dispatchEvent(new Event('change'));
    expect(deps.audio.muted).toBe(true);
    expect(shell.settings.values.muted).toBe(true);
  });

  it('changes the shared volume', () => {
    const deps = testDeps();
    const shell = createShell(root, deps);
    shell.showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    const volume = root.querySelector<HTMLInputElement>('[data-setting="volume"]')!;
    volume.value = '0.25';
    volume.dispatchEvent(new Event('input'));
    expect(deps.audio.volume).toBeCloseTo(0.25);
  });

  it('defaults music to off', () => {
    createShell(root, testDeps()).showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    expect(root.querySelector<HTMLInputElement>('[data-setting="music"]')!.checked).toBe(false);
  });

  it('closes again', () => {
    createShell(root, testDeps()).showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="close-settings"]')!.click();
    expect(root.querySelector('[data-panel="settings"]')).toBeNull();
  });
});

describe('sound lab', () => {
  it('offers a button for every sound event', async () => {
    const { buildSoundLab } = await import('./settings-panel.js');
    const lab = buildSoundLab(createAudioBus(() => fakeContext() as unknown as AudioContext));
    expect(lab.querySelectorAll('[data-sound-event]')).toHaveLength(SOUND_EVENTS.length);
  });

  it('plays a sound when a lab button is pressed', async () => {
    const { buildSoundLab } = await import('./settings-panel.js');
    const context = fakeContext();
    const audio = createAudioBus(() => context as unknown as AudioContext);
    const lab = buildSoundLab(audio);
    lab.querySelector<HTMLButtonElement>('[data-sound-event="ding"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.createdOscillators.length).toBeGreaterThan(0);
  });

  it('stays hidden until a long press on the settings heading', () => {
    const root = document.createElement('div');
    createShell(root, testDeps()).showLauncher();
    root.querySelector<HTMLButtonElement>('[data-action="open-settings"]')!.click();
    expect(root.querySelector('[data-panel="sound-lab"]')).toBeNull();
  });
});
