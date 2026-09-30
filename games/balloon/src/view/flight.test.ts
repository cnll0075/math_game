import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT, ledgeSpot } from './geometry.js';

const still: RescueDef = { id: 's', line: '', weight: 8, tray: [] };
const windy: RescueDef = { id: 'w', line: '', weight: 4, tray: [], wind: { ledge: 7, wind: 3, puffs: [] } };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) {
      expect(flightPose(still, outcome, 0).at).toEqual(HOME);
    }
  });

  it('ends on the ledge when it was just right', () => {
    expect(flightPose(still, judge(8, 8), 1).at).toEqual(ledgeSpot(still));
    expect(flightPose(windy, judge(4, 4, { have: 7, need: 7 }), 1).at).toEqual(ledgeSpot(windy));
    expect(flightPose(still, judge(8, 8), 1).mood).toBe('happy');
  });

  it('never really leaves the ground when it was too little', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(still, judge(6, 8), t);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(45);
      expect(pose.mood).toBe('strain');
    }
    expect(flightPose(still, judge(6, 8), 1).at).toEqual(HOME);
  });

  it('goes off the top when it was too much, and comes home by parachute', () => {
    expect(flightPose(still, judge(11, 8), 0.4).at.y).toBeLessThan(0);
    const landed = flightPose(still, judge(11, 8), 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('drifts as far as the wind and puffs reached, then parachutes back', () => {
    const outcome = judge(4, 4, { have: 5, need: 7 });
    expect(flightPose(windy, outcome, 0.66).at.x).toBeCloseTo(HOME.x + 5 * LAYOUT.stepWidth, 5);
    const landed = flightPose(windy, outcome, 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(still, judge(8, 8), 1.5).at).toEqual(ledgeSpot(still));
    expect(flightPose(still, judge(8, 8), -1).at).toEqual(HOME);
  });
});
