import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';

export interface BrambleOptions {
  /** A band id, so `?game=bramble&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

export interface BrambleModule extends GameModule<BrambleOptions> {
  mount(container: HTMLElement, host: GameHost, options?: BrambleOptions): Promise<GameSession>;
}

export const brambleGame: BrambleModule = {
  id: 'bramble',
  title: 'Bramble Dash',

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

export default brambleGame;
