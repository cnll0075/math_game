import { describe, it, expect } from 'vitest';
import { crateAt, HUD, onPause, QUEUE, slotCentre, trackAt, TRACKS } from './geometry.js';

describe('the yard', () => {
  it('runs the queue from the port to the marker, twelve slots, left to right', () => {
    expect(slotCentre(0).x).toBeLessThan(slotCentre(11).x);
    expect(slotCentre(11).x).toBeLessThan(QUEUE.markerX);
    expect(crateAt(slotCentre(3), 5)).toBe(3);
    expect(crateAt(slotCentre(7), 5)).toBeNull();
    expect(crateAt({ x: slotCentre(0).x, y: 300 }, 5)).toBeNull();
  });

  it('finds the track under a dropped crate, top to bottom, and nothing off the tracks', () => {
    TRACKS.forEach((track, index) => expect(trackAt({ x: 700, y: track.railY - 40 })).toBe(index));
    expect(trackAt({ x: 700, y: QUEUE.y })).toBeNull();
    expect(trackAt({ x: 120, y: TRACKS[0]!.railY - 40 })).toBeNull();
  });

  it('has a pause button in the top right', () => {
    expect(onPause({ x: HUD.pause.x, y: HUD.pause.y })).toBe(true);
    expect(onPause({ x: 500, y: 400 })).toBe(false);
  });
});
