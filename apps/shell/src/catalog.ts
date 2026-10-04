import { seesawGame } from '@bundle/seesaw';
import { skyGame } from '@bundle/sky';
import { brambleGame } from '@bundle/bramble';
import { balloonGame } from '@bundle/balloon';
import { pondGame } from '@bundle/pond';
import type { GameModule } from '@bundle/core';

export interface GameTile {
  id: string;
  title: string;
  /** Short, concrete, and readable to an adult choosing for a child. */
  blurb: string;
  /** Two colours for the tile's placeholder art. */
  colors: [string, string];
  module?: GameModule<{ startLevel?: string }>;
}

/**
 * The bundle. One game is real; the rest are placeholders so the shape of the
 * product is visible while the other nine are built.
 */
export const CATALOG: readonly GameTile[] = [
  { id: 'seesaw', title: 'Seesaw Park', blurb: 'Balance the animals', colors: ['#8fce72', '#5aa9d6'], module: seesawGame },
  { id: 'sky', title: 'Sky Patrol', blurb: 'Shoot the right answer', colors: ['#6fb6e8', '#2f6f9f'], module: skyGame },
  { id: 'bramble', title: 'Bramble Dash', blurb: 'Run the right way', colors: ['#8fce72', '#3f8f52'], module: brambleGame },
  { id: 'balloon', title: 'Balloon Rescue', blurb: 'Lift them just right', colors: ['#f7a8b8', '#7cc3ea'], module: balloonGame },
  { id: 'pond', title: 'Pond Pairs', blurb: 'Find the equal sums', colors: ['#7fc4c9', '#5aa9d6'], module: pondGame },
  { id: 'shapes', title: 'Shape Workshop', blurb: 'Build with shapes', colors: ['#e4695f', '#f2a65a'] },
  { id: 'patterns', title: 'Pattern Path', blurb: 'What comes next?', colors: ['#b48ee0', '#7b6bd6'] },
  { id: 'measure', title: 'Measuring Yard', blurb: 'How long is it?', colors: ['#5aa9d6', '#3f7fbf'] },
  { id: 'clock', title: 'Clock Tower', blurb: 'Tell the time', colors: ['#7fc4c9', '#3f9f8f'] },
  { id: 'halves', title: 'Sharing Table', blurb: 'Share it fairly', colors: ['#ef8fa6', '#d9607f'] },
];

export const playableGames = (): readonly GameTile[] => CATALOG.filter((tile) => tile.module);
