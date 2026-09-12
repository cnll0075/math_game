import './shell.css';
import { createShell } from './shell.js';

const root = document.querySelector<HTMLElement>('#app');

if (root) {
  const shell = createShell(root);
  // Development affordance: ?game=seesaw&level=level-4 jumps straight into a
  // level, so a change can be checked without replaying everything before it.
  const params = new URLSearchParams(location.search);
  const game = params.get('game');
  const level = params.get('level');
  if (game) void shell.openGame(game, level ? { startLevel: level } : undefined);
  else shell.showLauncher();
}
