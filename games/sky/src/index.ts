import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';

export interface SkyOptions {
  /** A band id, so `?game=sky&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

export interface SkyModule extends GameModule<SkyOptions> {
  mount(container: HTMLElement, host: GameHost, options?: SkyOptions): Promise<GameSession>;
}

export const skyGame: SkyModule = {
  id: 'sky',
  title: 'Sky Patrol',

  async mount(container, _host, _options = {}): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    const ticker = createTicker(() => {});
    ticker.start();

    return {
      pause: () => ticker.stop(),
      resume: () => ticker.start(),
      unmount() {
        ticker.stop();
        canvas.remove();
      },
    };
  },
};

export default skyGame;
