import type { GameModule, GameSession } from '@bundle/core';

export interface BalloonOptions {
  /** A rescue or chapter id, so `?game=balloon&level=pop-1` opens straight into Pop!. */
  startLevel?: string;
}

export const balloonGame: GameModule<BalloonOptions> = {
  id: 'balloon',
  title: 'Balloon Rescue',
  async mount(container): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    return {
      pause: () => {},
      resume: () => {},
      unmount: () => canvas.remove(),
    };
  },
};

export default balloonGame;
