import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side } from '../logic/seesaw-state.js';
import { SCENE, platformAnchor } from './geometry.js';
import { DESIGN, fitToScreen, slotPositions, type Point, type Size } from './layout.js';
import { createSpring } from './spring.js';
import type { AnimalPose, Expression, SeesawTheme, SeesawView } from './theme.js';

export interface SceneModel {
  snapshot: SeesawSnapshot;
  placed: readonly PlacedAnimal[];
  /** Normalized balance the target marker sits at, or null when unused. */
  targetBalance: number | null;
  gateOpen: boolean;
  celebrating: boolean;
}

export interface AnimalPlacement {
  animal: PlacedAnimal;
  pose: AnimalPose;
}

export interface Scene {
  update(dt: number, model: SceneModel): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  /** Where each placed animal currently sits, for hit testing. */
  placements(): AnimalPlacement[];
  toDesign(point: Point, screen: Size): Point;
  readonly tiltSettled: boolean;
  readonly plankAngle: number;
}

const expressionFor = (zone: SeesawSnapshot['zone']): Expression =>
  zone === 'green' ? 'calm' : zone === 'yellow' ? 'surprised' : 'alarmed';

const emptyModel = (): SceneModel => ({
  snapshot: describeSeesaw([]),
  placed: [],
  targetBalance: null,
  gateOpen: false,
  celebrating: false,
});

/**
 * The presentation half. It reads the balance state and turns it into motion;
 * it never writes back. Springs smooth the plank, the needle, and the flag, so
 * the visuals can lag the mathematics without ever contradicting it.
 */
export function createScene(theme: SeesawTheme): Scene {
  const tilt = createSpring(0);
  const needle = createSpring(0);
  const flag = createSpring(0);
  const gate = createSpring(0);

  let model = emptyModel();
  let time = 0;
  let celebrate = 0;
  /** Per-animal phase so a row of animals does not wobble in lockstep. */
  const phases = new Map<string, number>();

  const phaseFor = (uid: string): number => {
    let phase = phases.get(uid);
    if (phase === undefined) {
      // Deterministic per uid: same animal, same phase, every run.
      phase = [...uid].reduce((total, char) => total + char.charCodeAt(0), 0) % 100;
      phases.set(uid, phase);
    }
    return phase;
  };

  const viewState = (): SeesawView => ({
    plankAngle: tilt.value,
    needle: needle.value,
    zone: model.snapshot.zone,
    flagHeight: flag.value,
    flagSide: model.snapshot.heavySide,
    gateOpen: gate.value,
    celebrate,
    targetAngle: model.targetBalance === null ? null : -model.targetBalance * SCENE.maxTiltRad,
    time,
  });

  const placementsFor = (): AnimalPlacement[] => {
    const result: AnimalPlacement[] = [];
    const tiltAmount = tilt.value;

    for (const side of ['left', 'right'] as Side[]) {
      const animals = model.placed.filter((animal) => animal.side === side);
      const anchor = platformAnchor(side, tiltAmount);
      const slots = slotPositions(animals.length, SCENE.platformWidth);

      animals.forEach((animal, index) => {
        const offset = slots[index] ?? 0;
        const phase = phaseFor(animal.uid);
        const agitation = Math.abs(model.snapshot.normalizedBalance);
        const wobble = Math.sin(time * 5 + phase) * agitation;
        // Animals slide downhill, further the steeper the plank.
        const slide = Math.sin(tiltAmount) * 26 * (side === 'left' ? -1 : 1) * -1;

        const local = {
          x: anchor.x + offset * Math.cos(tiltAmount),
          y: anchor.y + offset * Math.sin(tiltAmount) - SCENE.platformHeight,
        };

        result.push({
          animal,
          pose: {
            x: local.x,
            y: local.y,
            scale: 0.78,
            tiltRad: tiltAmount,
            wobble,
            slide,
            expression: expressionFor(model.snapshot.zone),
          },
        });
      });
    }
    return result;
  };

  return {
    update(dt, next) {
      model = next;
      time += dt;

      tilt.target = -next.snapshot.normalizedBalance * SCENE.maxTiltRad;
      needle.target = next.snapshot.normalizedBalance;
      flag.target = next.snapshot.zone === 'red' ? 1 : 0;
      gate.target = next.gateOpen ? 1 : 0;

      tilt.step(dt);
      needle.step(dt);
      flag.step(dt);
      gate.step(dt);

      celebrate = next.celebrating ? Math.min(1, celebrate + dt * 3) : Math.max(0, celebrate - dt * 1.6);
    },

    render(ctx, screen) {
      const transform = fitToScreen(screen);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, screen.width, screen.height);
      // Letterbox bars.
      ctx.fillStyle = '#1d2b32';
      ctx.fillRect(0, 0, screen.width, screen.height);
      ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.offsetX, transform.offsetY);
      ctx.beginPath();
      ctx.rect(0, 0, DESIGN.width, DESIGN.height);
      ctx.save();
      ctx.clip();

      const view = viewState();
      theme.drawBackground(ctx, view);
      theme.drawGate(ctx, view);
      theme.drawSeesaw(ctx, view);
      for (const { animal, pose } of placementsFor()) theme.animals.draw(ctx, animal.species, pose);
      theme.drawFlag(ctx, view);
      theme.drawGauge(ctx, view);

      ctx.restore();
    },

    placements: placementsFor,

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    get tiltSettled() {
      return tilt.settled;
    },

    get plankAngle() {
      return tilt.value;
    },
  };
}
