import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { createRescue } from '../logic/rescue.js';
import { RESCUES } from '../logic/levels.data.js';
import type { RescueDef } from '../logic/rescue-def.js';
import {
  balloonRadius,
  bunchCount,
  bunchPoint,
  dropKit,
  HOME,
  hitTest,
  homeOf,
  inTray,
  LAYOUT,
  ledgeSpot,
  limpPoint,
  pegPoint,
  trayPoint,
} from './geometry.js';

const def: RescueDef = { id: 'g', line: '', weight: 8, tray: [5, 3, 6, 2] };
const pair: RescueDef = { id: 'p', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

describe('geometry', () => {
  it('makes a bigger number a bigger balloon', () => {
    for (let value = 1; value < 10; value += 1) expect(balloonRadius(value + 1)).toBeGreaterThan(balloonRadius(value));
  });

  it('keeps every tray balloon apart and on screen, in every rescue', () => {
    for (const rescue of RESCUES) {
      const points = rescue.tray.map((_, index) => trayPoint(rescue, index));
      points.forEach((point, index) => {
        const radius = balloonRadius(rescue.tray[index]!);
        expect(point.x - radius, rescue.id).toBeGreaterThanOrEqual(0);
        expect(point.x + radius, rescue.id).toBeLessThanOrEqual(LAYOUT.button.left);
        const next = points[index + 1];
        if (next) expect(next.x - point.x, rescue.id).toBeGreaterThanOrEqual(radius + balloonRadius(rescue.tray[index + 1]!) - 12);
      });
    }
  });

  it('keeps the peg beside the kit', () => {
    expect(pegPoint(HOME).x - HOME.x).toBeGreaterThan(30);
  });

  it('stands one kit at home, and two kits well apart', () => {
    expect(homeOf(def, 0)).toEqual(HOME);
    expect(homeOf(pair, 1).x - homeOf(pair, 0).x).toBeGreaterThanOrEqual(300);
  });

  it('lands every kit on the ledge, on screen, side by side', () => {
    for (const rescue of RESCUES) {
      expect(ledgeSpot(rescue).y).toBeLessThan(HOME.y);
      expect(ledgeSpot(rescue).x).toBeGreaterThan(0);
      expect(ledgeSpot(rescue).x).toBeLessThan(DESIGN.width);
    }
    expect(Math.abs(ledgeSpot(pair, 0).x - ledgeSpot(pair, 1).x)).toBeGreaterThanOrEqual(90);
    expect(ledgeSpot(pair, 1).x).toBeGreaterThan(0);
  });

  it('finds the tray balloon under a finger, and skips one already taken', () => {
    const rescue = createRescue(def);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toEqual({ kind: 'tray', index: 2 });
    rescue.clip(2);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toBeNull();
  });

  it('clips the balloon under the finger even where a squeezed tray lets tap circles overlap', () => {
    for (const rescue of RESCUES) {
      const state = createRescue(rescue).state;
      rescue.tray.forEach((value, index) => {
        const centre = trayPoint(rescue, index);
        const reach = balloonRadius(value) * 0.8;
        for (let step = 0; step < 8; step += 1) {
          const angle = (step / 8) * Math.PI * 2;
          const point = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
          expect(hitTest(point, state), `${rescue.id} balloon ${index}`).toEqual({ kind: 'tray', index });
        }
      });
    }
  });

  it('finds a clipped balloon on the harness', () => {
    const rescue = createRescue(def);
    rescue.clip(0);
    rescue.clip(1);
    expect(hitTest(bunchPoint(1, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 1 });
  });

  it('finds a tied balloon, which a tap pops', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.clip(0);
    expect(hitTest(bunchPoint(1, 4, HOME), rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest(bunchPoint(3, 4, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 0 });
  });

  it('finds a popped balloon where its scrap hangs, so a tap can blow it back up', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] });
    rescue.togglePop(1);
    const scrap = limpPoint(bunchPoint(1, 3, HOME));
    expect(hitTest(scrap, rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest({ x: scrap.x, y: scrap.y + 22 }, rescue.state)).toEqual({ kind: 'tied', index: 1 });
  });

  it('lays a limited harness out by its hooks, and finds its balloons there', () => {
    const limited: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 8] };
    const rescue = createRescue(limited);
    rescue.clip(1);
    expect(bunchCount(rescue.state)).toBe(2);
    expect(hitTest(bunchPoint(0, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 0 });
    expect(bunchCount(createRescue(def).state)).toBe(0);
  });

  it('finds a balloon on the second kit', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 1);
    expect(hitTest(bunchPoint(0, 1, homeOf(pair, 1)), rescue.state)).toEqual({ kind: 'clipped', kit: 1, slot: 0 });
  });

  it('selects a kit tapped in Two at Once, and does nothing for a lone kit', () => {
    const second = homeOf(pair, 1);
    expect(hitTest({ x: second.x, y: second.y - 55 }, createRescue(pair).state)).toEqual({ kind: 'select', kit: 1 });
    expect(hitTest({ x: HOME.x, y: HOME.y - 55 }, createRescue(def).state)).toBeNull();
  });

  it('finds the button and the start-over button', () => {
    const { left, top, width, height } = LAYOUT.button;
    expect(hitTest({ x: left + width / 2, y: top + height / 2 }, createRescue(def).state)).toEqual({ kind: 'letGo' });
    expect(hitTest({ x: LAYOUT.reset.x, y: LAYOUT.reset.y }, createRescue(def).state)).toEqual({ kind: 'reset' });
  });

  it('finds nothing in the open sky', () => {
    expect(hitTest({ x: 700, y: 120 }, createRescue(def).state)).toBeNull();
  });

  it('takes a drop near a kit, the nearer of two, and not one in the tray or on the button', () => {
    expect(dropKit({ x: HOME.x, y: HOME.y - 260 }, def)).toBe(0);
    expect(dropKit({ x: HOME.x + 150, y: HOME.y - 80 }, def)).toBe(0);
    expect(dropKit(trayPoint(def, 0), def)).toBeNull();
    expect(dropKit({ x: LAYOUT.button.left + 40, y: LAYOUT.button.top + 40 }, def)).toBeNull();
    expect(dropKit({ x: 1050, y: 200 }, def)).toBeNull();
    expect(dropKit({ x: homeOf(pair, 1).x, y: 330 }, pair)).toBe(1);
    expect(dropKit({ x: homeOf(pair, 0).x, y: 330 }, pair)).toBe(0);
  });

  it('knows a drop over the tray strip', () => {
    expect(inTray({ x: 400, y: LAYOUT.trayY })).toBe(true);
    expect(inTray({ x: 400, y: HOME.y - 200 })).toBe(false);
  });
});
