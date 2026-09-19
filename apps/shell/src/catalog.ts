import { seesawGame } from '@bundle/seesaw';
import { skyGame } from '@bundle/sky';
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
  { id: 'counting', title: 'Counting Meadow', blurb: 'Count the flowers', colors: ['#f7d05e', '#f2a65a'] },
  { id: 'shapes', title: 'Shape Workshop', blurb: 'Build with shapes', colors: ['#e4695f', '#f2a65a'] },
  { id: 'sorting', title: 'Sorting Station', blurb: 'Big, small, biggest', colors: ['#63c07a', '#3f9f8f'] },
  { id: 'patterns', title: 'Pattern Path', blurb: 'What comes next?', colors: ['#b48ee0', '#7b6bd6'] },
  { id: 'measure', title: 'Measuring Yard', blurb: 'How long is it?', colors: ['#5aa9d6', '#3f7fbf'] },
  { id: 'coins', title: 'Market Stall', blurb: 'Make it add up', colors: ['#f2b950', '#d98b3f'] },
  { id: 'clock', title: 'Clock Tower', blurb: 'Tell the time', colors: ['#7fc4c9', '#3f9f8f'] },
  { id: 'halves', title: 'Sharing Table', blurb: 'Share it fairly', colors: ['#ef8fa6', '#d9607f'] },
];

export const playableGames = (): readonly GameTile[] => CATALOG.filter((tile) => tile.module);
