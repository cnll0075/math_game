import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side } from '../logic/seesaw-state.js';
import { SCENE, platformAnchor } from './geometry.js';
import { DESIGN, fitToScreen, slotPositions, type Point, type Size } from './layout.js';
import { createSpring } from './spring.js';
import { TIMING } from './timing.js';
import { drawHud, drawSideTargets, traySlots, type TraySlot } from './hud.js';
import type { TrayItem } from '../logic/game.js';
import type { AnimalPose, Expression, SeesawTheme, SeesawView } from './theme.js';

export interface SceneModel {
  snapshot: SeesawSnapshot;
  placed: readonly PlacedAnimal[];
  /** Normalized balance the target marker sits at, or null when unused. */
  targetBalance: number | null;
  celebrating: boolean;
  /** Set while the level's finishing dance plays. */
  dancing: boolean;
  tray: readonly TrayItem[];
  selectedTrayIndex: number | null;
  caption: string;
  stageLabel: string | null;
  won: boolean;
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
  /** Where each waiting animal currently sits, for hit testing. */
  traySlots(): TraySlot[];
  toDesign(point: Point, screen: Size): Point;
  readonly tiltSettled: boolean;
  readonly plankAngle: number;
  readonly danceProgress: number;
}

const expressionFor = (zone: SeesawSnapshot['zone']): Expression =>
  zone === 'green' ? 'calm' : zone === 'yellow' ? 'surprised' : 'alarmed';

const emptyModel = (): SceneModel => ({
  snapshot: describeSeesaw([]),
  placed: [],
  targetBalance: null,
  celebrating: false,
  dancing: false,
  tray: [],
  selectedTrayIndex: null,
  caption: '',
  stageLabel: null,
  won: false,
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

  let model = emptyModel();
  let time = 0;
  let celebrate = 0;
  /** Seconds since the finishing dance began; negative when nobody is dancing. */
  let danceElapsed = -1;
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

  /** A gentle bob under the dancers. Rendering only; balance state is untouched. */
  const celebrationBob = (): number =>
    danceElapsed < 0 ? 0 : Math.sin(danceElapsed * 7) * 0.018 * danceIntensity();

  /** Fades the dance in quickly and out over its final third. */
  const danceIntensity = (): number => {
    if (danceElapsed < 0) return 0;
    const remaining = TIMING.danceSeconds - danceElapsed;
    if (remaining <= 0) return 0;
    return Math.min(1, danceElapsed / 0.12, remaining / 0.5);
  };

  /** Each animal starts its hop a beat after the one before it. */
  const danceFor = (index: number): number => {
    if (danceElapsed < 0) return 0;
    const start = index * TIMING.danceStaggerSeconds;
    const progress = (danceElapsed - start) / (TIMING.danceSeconds - start);
    if (progress <= 0 || progress >= 1) return 0;
    return progress * danceIntensity();
  };

  const viewState = (): SeesawView => ({
    plankAngle: tilt.value + celebrationBob(),
    needle: needle.value,
    zone: model.snapshot.zone,
    flagHeight: flag.value,
    flagSide: model.snapshot.heavySide,
    celebrate: Math.max(celebrate, danceIntensity()),
    targetAngle: model.targetBalance === null ? null : -model.targetBalance * SCENE.maxTiltRad,
    time,
  });

  const placementsFor = (): AnimalPlacement[] => {
    const result: AnimalPlacement[] = [];
    const tiltAmount = tilt.value + celebrationBob();
    let danceIndex = 0;

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

        // Feet on the basket floor, following the plank.
        const local = {
          x: anchor.x + offset * Math.cos(tiltAmount),
          y: anchor.y + offset * Math.sin(tiltAmount) - SCENE.platformHeight - 6,
        };

        const dance = danceFor(danceIndex);
        danceIndex += 1;

        result.push({
          animal,
          pose: {
            x: local.x,
            y: local.y,
            scale: 0.92,
            tiltRad: tiltAmount,
            // Dancers hold still apart from the hop; a wobble on top reads as noise.
            wobble: dance > 0 ? 0 : wobble,
            slide,
            dance,
            expression: dance > 0 ? 'cheer' : expressionFor(model.snapshot.zone),
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

      tilt.step(dt);
      needle.step(dt);
      flag.step(dt);

      if (next.dancing) danceElapsed = danceElapsed < 0 ? 0 : danceElapsed + dt;
      else danceElapsed = -1;

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
      if (model.selectedTrayIndex !== null) drawSideTargets(ctx, view.plankAngle, time);
      theme.drawSeesaw(ctx, view);
      for (const { animal, pose } of placementsFor()) theme.animals.draw(ctx, animal.species, pose);
      theme.drawTarget(ctx, view);
      theme.drawFlag(ctx, view);
      theme.drawGauge(ctx, view);
      theme.drawCelebration(ctx, view);
      drawHud(
        ctx,
        theme,
        {
          tray: model.tray,
          selectedTrayIndex: model.selectedTrayIndex,
          caption: model.caption,
          stageLabel: model.stageLabel,
          won: model.won,
        },
        time,
      );

      ctx.restore();
    },

    placements: placementsFor,

    traySlots: () => traySlots(model.tray),

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    get tiltSettled() {
      return tilt.settled;
    },

    get plankAngle() {
      return tilt.value + celebrationBob();
    },

    /** How far through the finishing dance the scene is, 0 when not dancing. */
    get danceProgress() {
      return danceElapsed < 0 ? 0 : Math.min(1, danceElapsed / TIMING.danceSeconds);
    },
  };
}
