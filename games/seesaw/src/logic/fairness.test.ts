import { describe, it, expect } from 'vitest';
import { bestOutcome, isFairArrival } from './fairness.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';

const config = DEFAULT_BALANCE_CONFIG; // green <= 1, yellow <= 3

describe('bestOutcome', () => {
  it('reports the smaller of the two differences the player could choose', () => {
    // Left is 4 heavier; a weight of 3 can bring it to 1.
    expect(bestOutcome(4, 3)).toBe(1);
    expect(bestOutcome(-4, 3)).toBe(1);
  });

  it('knows a heavy animal can overshoot either way', () => {
    expect(bestOutcome(0, 5)).toBe(5);
  });
});

describe('isFairArrival', () => {
  it('accepts an animal the player can place safely', () => {
    expect(isFairArrival({ weight: 2, balanceDifference: 2, config, recentHeavy: 0 })).toBe(true);
  });

  it('rejects an animal that leaves the player in the red whichever side they pick', () => {
    // Already 4 heavy on the left; a bear either makes it 9 or -1... which is
    // recoverable. A bear onto a difference of 0 gives 5 or -5: both red.
    expect(isFairArrival({ weight: 5, balanceDifference: 0, config, recentHeavy: 0 })).toBe(false);
  });

  it('accepts a heavy animal when it can undo an existing lean', () => {
    expect(isFairArrival({ weight: 5, balanceDifference: 4, config, recentHeavy: 0 })).toBe(true);
  });

  it('refuses to send too many heavy animals in a row', () => {
    expect(isFairArrival({ weight: 3, balanceDifference: 0, config, recentHeavy: 2, maxHeavyRun: 2 })).toBe(false);
    expect(isFairArrival({ weight: 1, balanceDifference: 0, config, recentHeavy: 9, maxHeavyRun: 2 })).toBe(true);
  });

  it('always allows the lightest animal, so a round can never stall', () => {
    for (const difference of [-9, -4, 0, 4, 9]) {
      expect(isFairArrival({ weight: 1, balanceDifference: difference, config, recentHeavy: 0 })).toBe(true);
    }
  });
});
