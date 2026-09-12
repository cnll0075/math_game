import { CATALOG, type GameTile } from './catalog.js';
import type { ContentManifest } from '@bundle/core';

export interface LauncherDeps {
  content: ContentManifest;
  onOpen(tile: GameTile): void;
  onSettings(): void;
}

const tileButton = (tile: GameTile, unlocked: boolean, onOpen: () => void): HTMLElement => {
  const button = document.createElement('button');
  button.className = 'tile';
  button.dataset.gameTile = tile.id;
  button.style.background = `linear-gradient(150deg, ${tile.colors[0]}, ${tile.colors[1]})`;

  const playable = Boolean(tile.module) && unlocked;
  if (!playable) {
    button.classList.add('tile--locked');
    button.disabled = true;
    const badge = document.createElement('span');
    badge.className = 'tile__badge';
    badge.textContent = tile.module ? 'Locked' : 'Soon';
    if (!tile.module) button.dataset.comingSoon = 'true';
    else button.dataset.locked = 'true';
    button.appendChild(badge);
  }

  const title = document.createElement('span');
  title.className = 'tile__title';
  title.textContent = tile.title;
  const blurb = document.createElement('span');
  blurb.className = 'tile__blurb';
  blurb.textContent = tile.blurb;
  button.append(title, blurb);

  if (playable) button.addEventListener('click', onOpen);
  return button;
};

/** The bundle's front door: ten tiles, one per game. */
export function createLauncher(deps: LauncherDeps): HTMLElement {
  const root = document.createElement('div');
  root.className = 'launcher';
  root.dataset.screen = 'launcher';

  const title = document.createElement('h1');
  title.className = 'launcher__title';
  title.textContent = 'Math Park';
  const subtitle = document.createElement('p');
  subtitle.className = 'launcher__subtitle';
  subtitle.textContent = 'Ten little games';

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const tile of CATALOG) {
    grid.appendChild(
      tileButton(tile, deps.content.isUnlocked(tile.id), () => deps.onOpen(tile)),
    );
  }

  const settings = document.createElement('button');
  settings.className = 'corner corner--settings';
  settings.textContent = '⚙';
  settings.dataset.action = 'open-settings';
  settings.setAttribute('aria-label', 'Settings');
  settings.addEventListener('click', deps.onSettings);

  root.append(title, subtitle, grid, settings);
  return root;
}
