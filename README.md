# Math Park

A bundle of ten little math games for iPad. One game is built: **Seesaw Park**,
in which animal weights drive a seesaw and the arithmetic is the mechanic rather
than the subject.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the whole suite
npm run typecheck  # tsc, strict
npm run build      # production bundle into dist/
```

It runs full-screen in iPad Safari as-is, and is structured to be wrapped in
Capacitor/WKWebView for the App Store.

Development shortcut: `?game=seesaw&level=level-4` opens a level directly.

## Layout

```
packages/core/   shared runtime: audio bus, storage, settings, entitlements, ticker, rng
apps/shell/      the bundle app: launcher grid, settings, sound lab, game host
games/seesaw/    the first game
  src/logic/     pure rules — no DOM, no timers, no audio
  src/view/      canvas presentation — reads state, never writes it
  src/audio/     the seesaw's sound pack
docs/superpowers/specs/   design spec
docs/superpowers/plans/   implementation plan
```

The shell owns the single audio bus, profile store, settings object, and
entitlement check, and passes them to a game through `GameHost`. Games own
nothing global, so adding the next nine changes the catalog and nothing else.

## Adding or changing a level

Edit `games/seesaw/src/logic/levels.data.ts`. A level is data:

```ts
{
  id: 'level-3',
  mode: 'puzzle',
  title: 'Go Down',
  objective: { kind: 'sideDown', side: 'right' },
  initial: { left: ['dog'], right: ['rabbit'] },
  tray: ['cat', 'rabbit', 'dog'],
}
```

Objectives are `balance`, `sideDown`, `tilt` (an exact weight difference, shown
as a star), and `sequence` (several in a row). No gameplay code branches on a
level id.

`levels.test.ts` brute-forces every level to prove it is solvable from its tray,
so a level that cannot be won fails the suite rather than reaching a child.

## Swapping the art

All drawing goes through `SeesawTheme` (`games/seesaw/src/view/theme.ts`).
`createVectorTheme()` is the prototype: flat shapes drawn in code, no assets.

To use real art, implement the same interface — `drawBackground`, `drawSeesaw`,
`drawTarget`, `drawGauge`, `drawFlag`, `drawCelebration`, and an `AnimalArtist`
— and pass it to `createScene`. `preload()` is awaited during `mount`, so a
theme that loads images needs no other change.

Animals are drawn from an `AnimalPose`: position, scale, plank angle, wobble,
slide, a `dance` value, and one of four expressions. Whole-body art per
expression drops in unchanged, and a sprite theme drives a dance clip from
`dance` instead of the procedural hop. Sprite-sheet or rigged animation (Rive,
Spine) for the *other* states needs one more field on `AnimalPose` — a clip name
and time — with the theme driving clips instead of the procedural transforms.

Animation timing lives in `view/timing.ts`, separate from the theme, so retuning
the feel and swapping the art stay independent jobs.

## Swapping the sounds

Sounds are synthesised through Web Audio; there are no audio files.
`createSynthSoundPack` implements `SoundPack`, whose events are `ding`, `creak`,
`land`, `danger`, `success`, `cheer`, and `chirp:<species>`. Every event honours
a `delay` param, which is how the celebration staggers its chirps without
timers. A pack backed by recordings implements the same names and is swapped in
one line.

The **sound lab** fires each event from a button, for auditioning candidates
without replaying a level: open Settings and long-press the "Settings" heading
for three seconds.

Music defaults to off — the game is built to feel complete muted.

## Layout

The design space is 1152x768 (3:2). Gameplay stays inside it and is visible on
every screen; scenery paints across the whole canvas, so a screen of a different
shape is filled with park rather than letterbox bars. The clearances that let
the seesaw fill the frame — baskets missing the ground and the gauge at full
tilt, the tray clearing the fulcrum — are pinned by tests in `layout.test.ts`,
because they all sit close to something they must not collide with.

## Design rules worth keeping

- The mathematical state is authoritative. Perfect balance is
  `leftWeight === rightWeight`, edge-triggered, never derived from the rendered
  angle — visual smoothing can never move the moment the bell rings.
- The presentation layer reads game state and never writes to it.
- Animal weights exist only in the animal catalog, including the numeral each
  animal wears.
- Finishing a level is celebrated by the animals themselves — they hop, cheer,
  and chirp in a wave while the plank bobs — not by a score screen. The bob is
  added to the rendered angle only and never reaches the balance state.
- Games never ask whether the player paid; the shell hands down a content
  manifest.

## Not built yet

Levels 6–10 (the arcade half): the animal queue, the generator and its fairness
validator, environmental events, and endless play. The `Objective` union and the
level schema have room for them, and the seeded RNG in core exists for the
generator. The spec calls for validating the core interaction first.

Also deliberately absent: real IAP wiring, accounts, analytics, and the other
nine games.
