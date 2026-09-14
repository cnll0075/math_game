export type AnimalId = 'chicken' | 'cat' | 'dog' | 'bear';

/**
 * A cry, described rather than recorded: a pitch that slides, repeated a few
 * times, with a timbre. The sound pack turns this into oscillators.
 */
export interface AnimalVoice {
  /** Where the call starts and ends, in hertz. */
  from: number;
  to: number;
  seconds: number;
  /** How many times it repeats, for a cluck or a double bark. */
  repeats: number;
  /** Gap between repeats, in seconds. */
  gap: number;
  type: OscillatorType;
  /** Roughness, from 0 (a clean whistle) to 1 (a growl). */
  grit: number;
}

export interface AnimalDef {
  id: AnimalId;
  /** The only place a weight is ever written. Gameplay code reads it from here. */
  weight: number;
  label: string;
  /** What a child calls it, for the little stories the levels tell. */
  name: string;
  palette: { body: string; accent: string; belly: string };
  /** How it sounds when touched. Every animal here has a noise a child knows. */
  voice: AnimalVoice;
}

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  chicken: {
    id: 'chicken',
    weight: 1,
    label: 'Chicken',
    name: 'Pip',
    palette: { body: '#fdfaf4', accent: '#e4574b', belly: '#f3e6cf' },
    // Cluck: three quick clipped notes, dropping.
    voice: { from: 900, to: 640, seconds: 0.07, repeats: 3, gap: 0.09, type: 'square', grit: 0.35 },
  },
  cat: {
    id: 'cat',
    weight: 2,
    label: 'Cat',
    name: 'Mango',
    palette: { body: '#f6a96b', accent: '#d9814a', belly: '#ffe3c8' },
    // Meow: one note that rises then falls away.
    voice: { from: 620, to: 480, seconds: 0.42, repeats: 1, gap: 0, type: 'sawtooth', grit: 0.2 },
  },
  dog: {
    id: 'dog',
    weight: 3,
    label: 'Dog',
    name: 'Scout',
    palette: { body: '#b98a5c', accent: '#8d6440', belly: '#f0dcc2' },
    // Woof woof: two short barks, low and blunt.
    voice: { from: 300, to: 170, seconds: 0.12, repeats: 2, gap: 0.19, type: 'square', grit: 0.55 },
  },
  bear: {
    id: 'bear',
    weight: 5,
    label: 'Bear',
    name: 'Bramble',
    palette: { body: '#8d6e63', accent: '#5f4a42', belly: '#d7bfa6' },
    // Growl: long, low and rough.
    voice: { from: 130, to: 92, seconds: 0.7, repeats: 1, gap: 0, type: 'sawtooth', grit: 0.9 },
  },
};

/** Lightest first: the order the tray and any picker should show. */
export const ANIMAL_IDS: readonly AnimalId[] = ['chicken', 'cat', 'dog', 'bear'];

export const weightOf = (id: AnimalId): number => ANIMALS[id].weight;
