import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT } from './geometry.js';

const spot = { x: 140, y: LAYOUT.ledgeY };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) expect(flightPose(outcome, 0, HOME, spot).at).toEqual(HOME);
  });

  it('ends on the ledge when it was just right', () => {
    const landed = flightPose(judge(8, 8), 1, HOME, spot);
    expect(landed.at).toEqual(spot);
    expect(landed.mood).toBe('happy');
  });

  it('is carried left onto the cliff by the breeze at the ledge\'s height', () => {
    const pose = flightPose(judge(8, 8), 0.8, HOME, spot);
    expect(pose.at.x).toBeLessThan(HOME.x);
    expect(pose.at.y).toBeLessThanOrEqual(LAYOUT.ledgeY);
  });

  it('never really leaves the ground when it was too little', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(judge(6, 8), t, HOME, spot);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(45);
      expect(pose.mood).toBe('strain');
    }
    expect(flightPose(judge(6, 8), 1, HOME, spot).at).toEqual(HOME);
  });

  it('goes off the top when it was too much, and comes home by parachute', () => {
    expect(flightPose(judge(11, 8), 0.4, HOME, spot).at.y).toBeLessThan(0);
    const landed = flightPose(judge(11, 8), 1, HOME, spot);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('flies from wherever the kit stands', () => {
    const second = { x: 600, y: HOME.y };
    expect(flightPose(judge(8, 8), 0, second, spot).at).toEqual(second);
    expect(flightPose(judge(8, 8), 1, second, spot).at).toEqual(spot);
    expect(flightPose(judge(11, 8), 1, second, spot).at).toEqual(second);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(judge(8, 8), 1.5, HOME, spot).at).toEqual(spot);
    expect(flightPose(judge(8, 8), -1, HOME, spot).at).toEqual(HOME);
  });

  it('shows a right kit off at ledge height, then brings it home, when its friend is not right yet', () => {
    const mid = flightPose(judge(8, 8), 0.5, HOME, spot, false);
    expect(mid.at.y).toBeLessThanOrEqual(LAYOUT.ledgeY);
    expect(mid.at.x).toBe(HOME.x);
    const end = flightPose(judge(8, 8), 1, HOME, spot, false);
    expect(end.at).toEqual(HOME);
    expect(end.parachute).toBe(false);
  });
});
