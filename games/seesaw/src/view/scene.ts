import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side } from '../logic/seesaw-state.js';
import { SCENE, platformAnchor } from './geometry.js';
import { DESIGN, fitToScreen, slotPositions, visibleBounds, type Bounds, type Point, type Size } from './layout.js';
import { createSpring } from './spring.js';
import { TIMING } from './timing.js';
import { drawHud, drawSideTargets, queueSlots, traySlots, type TraySlot } from './hud.js';
import type { TrayItem } from '../logic/game.js';
import type { AnimalId } from '../logic/animals.js';
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
  /** Arcade only; empty in a puzzle. */
  queue: readonly AnimalId[];
  /** Which queued animal is chosen. */
  selectedQueueIndex: number;
  /** When above zero, the first this many are a family that must all be seated. */
  groupSize: number;
  /** Bells rung, and how many the level asks for. */
  bells: number;
  bellTarget: number | null;
  /** Arcade only: 0..1 through the round, or null in a puzzle. */
  progress: number | null;
  /** Arcade only: 0..1 how close the waiting animal is to placing itself. */
  impatience: number;
  /** Arcade only: 0..1 how full the danger meter is. */
  danger: number;
  /** Arcade only: the weather. */
  wind: SeesawView['wind'];
  /** Changes whenever a new goal is being asked for, which triggers its arrival. */
  goalToken: string;
  /** How many challenges this level has, and how many are done. */
  stages: number;
  stagesCleared: number;
  /** Timed arcade levels: seconds left, for the countdown. */
  secondsRemaining: number | null;
  /** Show the player where an arcade animal can be seated. */
  showPlacementHint: boolean;
  /** Endless only: seconds survived so far, and the record to beat. */
  survivalSeconds: number | null;
  bestSeconds: number | null;
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
  readonly announcing: boolean;
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
  queue: [],
  selectedQueueIndex: 0,
  groupSize: 0,
  bells: 0,
  bellTarget: null,
  progress: null,
  impatience: 0,
  danger: 0,
  wind: { phase: 'calm', side: 'left', strength: 0, through: 0 },
  survivalSeconds: null,
  bestSeconds: null,
  goalToken: '',
  stages: 1,
  stagesCleared: 0,
  secondsRemaining: null,
  showPlacementHint: false,
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
  /** The canvas in design coordinates; scenery paints across it. */
  let bounds: Bounds = { left: 0, top: 0, right: DESIGN.width, bottom: DESIGN.height };
  let celebrate = 0;
  /** Seconds left of the current goal announcement; negative when idle. */
  let announcing = -1;
  let announcedToken = '';
  let stagesCleared = 0;
  /** Counts down briefly each time a stage is stamped off. */
  let stamp = 0;
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
    danger: model.danger,
    wind: model.wind,
    targetAngle: model.targetBalance === null ? null : -model.targetBalance * SCENE.maxTiltRad,
    bounds,
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
            scale: 1.08,
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

      // A new goal announces itself, whether that is a new level or the next
      // challenge within one.
      if (next.goalToken !== announcedToken) {
        announcedToken = next.goalToken;
        announcing = TIMING.goalAnnounceSeconds;
      } else if (announcing > 0) {
        announcing = Math.max(0, announcing - dt);
      }

      if (next.stagesCleared > stagesCleared) stamp = 0.9;
      stagesCleared = next.stagesCleared;
      if (stamp > 0) stamp = Math.max(0, stamp - dt);

      celebrate = next.celebrating ? Math.min(1, celebrate + dt * 3) : Math.max(0, celebrate - dt * 1.6);
    },

    render(ctx, screen) {
      const transform = fitToScreen(screen);
      bounds = visibleBounds(screen, transform);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, screen.width, screen.height);
      ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.offsetX, transform.offsetY);
      ctx.save();

      const view = viewState();
      theme.drawBackground(ctx, view);
      // In the arcade there is no picking-up step, so the landing zones show
      // themselves whenever an animal is waiting: without this there is nothing
      // on screen saying that a side tap is what seats it.
      const waiting = model.selectedTrayIndex !== null || model.queue.length > 0;
      if (waiting) drawSideTargets(ctx, view.plankAngle, time, model.showPlacementHint ? 1 : 0.55);
      theme.drawSeesaw(ctx, view);
      for (const { animal, pose } of placementsFor()) theme.animals.draw(ctx, animal.species, pose);
      theme.drawTarget(ctx, view);
      theme.drawFlag(ctx, view);
      theme.drawWeather(ctx, view);
      theme.drawGauge(ctx, view);
      theme.drawDanger(ctx, view);
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
          queue: model.queue,
          selectedQueueIndex: model.selectedQueueIndex,
          groupSize: model.groupSize,
          bells: model.bells,
          bellTarget: model.bellTarget,
          progress: model.progress,
          impatience: model.impatience,
          survivalSeconds: model.survivalSeconds,
          bestSeconds: model.bestSeconds,
          stages: model.stages,
          stagesCleared: model.stagesCleared,
          secondsRemaining: model.secondsRemaining,
          showPlacementHint: model.showPlacementHint,
          announcing: announcing > 0 ? 1 - announcing / TIMING.goalAnnounceSeconds : null,
          stamp,
        },
        time,
      );

      ctx.restore();
    },

    placements: placementsFor,

    // The arcade hand is choosable in exactly the way the tray is, so it hit
    // tests through the same path.
    traySlots: () => (model.queue.length > 0 ? queueSlots(model.queue) : traySlots(model.tray)),

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    get tiltSettled() {
      return tilt.settled;
    },

    get plankAngle() {
      return tilt.value + celebrationBob();
    },

    /** Whether a goal is being announced right now. */
    get announcing() {
      return announcing > 0;
    },

    /** How far through the finishing dance the scene is, 0 when not dancing. */
    get danceProgress() {
      return danceElapsed < 0 ? 0 : Math.min(1, danceElapsed / TIMING.danceSeconds);
    },
  };
}
