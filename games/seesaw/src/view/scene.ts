import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side } from '../logic/seesaw-state.js';
import { SCENE, platformAnchor } from './geometry.js';
import { ANIMAL_ART } from './animals-art.js';
import { DESIGN, fitToScreen, layOutRow, visibleBounds, type Bounds, type Point, type Size } from './layout.js';
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
  won: boolean;
  /** Changes whenever a new goal is being asked for, which triggers its arrival. */
  goalToken: string;
  /** How many rounds this level has, and how many are done. */
  /** The chapter's name, on the question that opens it. */
  chapter: string | null;
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
  readonly danger: number;
}

/**
 * Weight difference at which the warning starts, and how much further until it
 * is at full strength. Past three the plank is beyond the gauge's yellow band.
 */
const DANGER_FROM = 3;
const DANGER_FULL = 3;

const expressionFor = (zone: SeesawSnapshot['zone'], mayBeAlarmed = true): Expression =>
  zone === 'green' ? 'calm' : zone === 'yellow' || !mayBeAlarmed ? 'surprised' : 'alarmed';

const emptyModel = (): SceneModel => ({
  snapshot: describeSeesaw([]),
  placed: [],
  targetBalance: null,
  celebrating: false,
  dancing: false,
  tray: [],
  selectedTrayIndex: null,
  caption: '',
  won: false,
  goalToken: '',
  chapter: null,
});

/**
 * The presentation half. It reads the balance state and turns it into motion;
 * it never writes back. Springs smooth the plank, the needle and the danger glow, so
 * the visuals can lag the mathematics without ever contradicting it.
 */
export function createScene(theme: SeesawTheme): Scene {
  const tilt = createSpring(0);
  const needle = createSpring(0);
  /** How far past safely tilted, smoothed so the warning fades rather than blinks. */
  const danger = createSpring(0);
  const levelled = createSpring(0);

  let model = emptyModel();
  let time = 0;
  /** The canvas in design coordinates; scenery paints across it. */
  let bounds: Bounds = { left: 0, top: 0, right: DESIGN.width, bottom: DESIGN.height };
  let celebrate = 0;
  /** Seconds left of the current goal announcement; negative when idle. */
  let announcing = -1;
  let announcedToken = '';
  /** Seconds since the finishing dance began; negative when nobody is dancing. */
  let danceElapsed = -1;
  /** Per-animal phase so a row of animals does not wobble in lockstep. */
  const phases = new Map<string, number>();
  /**
   * Seconds left of each animal's journey to its place. Animals travel in from
   * the tray under their own power rather than blinking into existence.
   */
  const arrivals = new Map<string, number>();
  const previouslyPlaced = new Set<string>();
  /** The first frame of a level: whatever is on the plank was always there. */
  let firstLook = true;
  /** How lopsided the question started out, which is not itself a problem. */
  let startingGap = 0;

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
    celebrate: Math.max(celebrate, danceIntensity()),
    danger: danger.value,
    levelled: levelled.value,
    targetAngle: model.targetBalance === null ? null : -model.targetBalance * SCENE.maxTiltRad,
    totals: { left: model.snapshot.leftWeight, right: model.snapshot.rightWeight },
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
      const row = layOutRow(
        animals.map((animal) => ANIMAL_ART[animal.species].height * ANIMAL_ART[animal.species].aspect),
        SCENE.basketInner,
        1.08,
      );

      // Only the animal at the very end of the side that is down looks alarmed.
      // The painted animals cannot pull a face, so alarm is a mark above them,
      // and one mark says "trouble" where four say "noise".
      //
      // Read off the danger meter rather than off the zone, so it means the same
      // thing the red glow means: you have made this worse. A question that
      // begins steeply tilted is the puzzle, and a warning over it before the
      // child has touched anything reads as a mistake they have not made.
      const worried =
        danger.value > 0.35 && model.snapshot.heavySide === side ? animals.length - 1 : -1;

      animals.forEach((animal, index) => {
        const offset = row.offsets[index] ?? 0;
        const phase = phaseFor(animal.uid);
        const agitation = Math.abs(model.snapshot.normalizedBalance);
        const wobble = Math.sin(time * 5 + phase) * agitation;
        // Animals slide downhill, further the steeper the plank.
        const slide = Math.sin(tiltAmount) * 26 * (side === 'left' ? -1 : 1) * -1;

        // Sitting in the basket at the same depth whatever size they are drawn,
        // so the near wall cuts every animal at the same point on its body.
        const ride =
          SCENE.basketWallTop - SCENE.submerge * ANIMAL_ART[animal.species].height * row.scale;
        const local = {
          x: anchor.x + offset * Math.cos(tiltAmount),
          y: anchor.y + offset * Math.sin(tiltAmount) - ride,
        };

        const dance = danceFor(danceIndex);
        danceIndex += 1;
        const travel = arrivals.get(animal.uid) ?? 0;
        const arriving = travel <= 0 ? 1 : 1 - travel / TIMING.arriveSeconds;
        // Travelling animals set off from the tray and fly, run or lumber up.
        const from = { x: DESIGN.width / 2, y: SCENE.trayY };
        const journey = arriving >= 1 ? 0 : 1 - arriving;

        result.push({
          animal,
          pose: {
            x: local.x + (from.x - local.x) * journey,
            y: local.y + (from.y - local.y) * journey,
            scale: row.scale,
            tiltRad: tiltAmount,
            // Dancers hold still apart from the hop; a wobble on top reads as noise.
            wobble: dance > 0 ? 0 : wobble,
            slide,
            dance,
            arriving,
            clock: time,
            // Animals look in towards the middle, so the two sides face off.
            facing: side === 'left' ? 1 : -1,
            expression:
              dance > 0 ? 'cheer' : index === worried ? 'alarmed' : expressionFor(model.snapshot.zone, false),
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

      // Anything newly on the plank sets off from the tray; anything gone stops
      // being tracked. Animals a level starts with are already in place, so
      // they do not travel: only what the player adds does.
      const present = new Set(next.placed.map((animal) => animal.uid));
      for (const uid of present) {
        if (!previouslyPlaced.has(uid) && !firstLook) arrivals.set(uid, TIMING.arriveSeconds);
      }
      firstLook = false;
      for (const uid of [...arrivals.keys()]) {
        if (!present.has(uid)) arrivals.delete(uid);
        else {
          const left = (arrivals.get(uid) ?? 0) - dt;
          if (left <= 0) arrivals.delete(uid);
          else arrivals.set(uid, left);
        }
      }
      previouslyPlaced.clear();
      for (const uid of present) previouslyPlaced.add(uid);

      tilt.target = -next.snapshot.normalizedBalance * SCENE.maxTiltRad;
      needle.target = next.snapshot.normalizedBalance;
      // The warning means "you have made this worse", not "this is a hard
      // question": a level that begins badly tilted is the puzzle, so the
      // starting gap is the mark to beat rather than something to warn about.
      const gap = Math.abs(next.snapshot.balanceDifference);
      const over = gap - Math.max(startingGap, DANGER_FROM);
      danger.target = Math.min(1, Math.max(0, over / DANGER_FULL));

      tilt.step(dt);
      needle.step(dt);
      levelled.target = next.snapshot.isPerfectlyBalanced ? 1 : 0;
      danger.step(dt);
      levelled.step(dt);

      if (next.dancing) danceElapsed = danceElapsed < 0 ? 0 : danceElapsed + dt;
      else danceElapsed = -1;

      // A new goal announces itself, whether that is a new level or the next
      // challenge within one.
      if (next.goalToken !== announcedToken) {
        announcedToken = next.goalToken;
        announcing = TIMING.goalAnnounceSeconds;
        arrivals.clear();
        firstLook = true;
        startingGap = Math.abs(next.snapshot.balanceDifference);
        danger.snap(0);
      } else if (announcing > 0) {
        announcing = Math.max(0, announcing - dt);
      }


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
      if (model.selectedTrayIndex !== null) drawSideTargets(ctx, view.plankAngle, time);
      theme.drawSeesaw(ctx, view);
      // Animals first, then every tag: a number hidden behind the animal in
      // front of it would have a child guessing at a weight.
      const onThePlank = placementsFor();
      for (const { animal, pose } of onThePlank) theme.animals.draw(ctx, animal.species, pose);
      theme.drawSeesawFront(ctx, view);
      theme.drawLevelFlag(ctx, view);
      theme.drawTotals(ctx, view);
      for (const { animal, pose } of onThePlank) theme.animals.drawTag(ctx, animal.species, pose);
      theme.drawTarget(ctx, view);
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
          won: model.won,
          chapter: model.chapter,
          announcing: announcing > 0 ? 1 - announcing / TIMING.goalAnnounceSeconds : null,
        },
        time,
      );

      ctx.restore();
    },

    placements: placementsFor,

    // The arcade hand is choosable in exactly the way the tray is, so it hit
    // tests through the same path.
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

    /** 0..1 how badly the plank is over, for tests and for the warning. */
    get danger() {
      return danger.value;
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
