import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT, layerY, ledgeSpot } from './geometry.js';

const still: RescueDef = { id: 's', line: '', weight: 8, tray: [] };
const windy: RescueDef = { id: 'w', line: '', weight: 7, tray: [], layer: 2 };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) expect(flightPose(still, outcome, 0).at).toEqual(HOME);
    for (const lift of [5, 7, 8, 9, 12]) expect(flightPose(windy, judge(lift, 7, 2), 0).at).toEqual(HOME);
  });

  it('ends on the ledge when it was just right', () => {
    expect(flightPose(still, judge(8, 8), 1).at).toEqual(ledgeSpot(still));
    expect(flightPose(windy, judge(9, 7, 2), 1).at).toEqual(ledgeSpot(windy));
    expect(flightPose(still, judge(8, 8), 1).mood).toBe('happy');
  });

  it('is carried left onto the cliff by the breeze at the ledge\'s height', () => {
    const pose = flightPose(still, judge(8, 8), 0.8);
    expect(pose.at.x).toBeLessThan(HOME.x);
    expect(pose.at.y).toBeLessThanOrEqual(LAYOUT.ledgeY);
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

  it('rises to the layer it reached, is blown away from the ledge, and parachutes home', () => {
    const oneUp = judge(8, 7, 2);
    const mid = flightPose(windy, oneUp, 0.66);
    expect(mid.at.y).toBeCloseTo(layerY(1) - 14, 5);
    expect(mid.at.x).toBeLessThan(HOME.x);
    const landed = flightPose(windy, oneUp, 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('whooshes off the top from past the last layer', () => {
    expect(flightPose(windy, judge(12, 7, 2), 0.4).at.y).toBeLessThan(0);
  });

  it('lifts off and settles back, no parachute, on exactly the weight', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(windy, judge(7, 7, 2), t);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(70);
      expect(pose.parachute).toBe(false);
    }
    expect(flightPose(windy, judge(7, 7, 2), 1).at).toEqual(HOME);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(still, judge(8, 8), 1.5).at).toEqual(ledgeSpot(still));
    expect(flightPose(still, judge(8, 8), -1).at).toEqual(HOME);
  });
});
