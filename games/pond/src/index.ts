import type { GameModule, GameSession } from '@bundle/core';

export interface PondOptions {
  /** A board id, so `?game=pond&level=board-5` opens straight onto the 5×5 board. */
  startLevel?: string;
}

export const pondGame: GameModule<PondOptions> = {
  id: 'pond',
  title: 'Pond Pairs',
  async mount(container): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    return { pause: () => {}, resume: () => {}, unmount: () => canvas.remove() };
  },
};

export default pondGame;
