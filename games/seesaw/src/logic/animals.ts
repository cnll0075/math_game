export type AnimalId = 'rabbit' | 'cat' | 'dog' | 'bear';

export interface AnimalDef {
  id: AnimalId;
  /** The only place a weight is ever written. Gameplay code reads it from here. */
  weight: number;
  label: string;
  palette: { body: string; accent: string; belly: string };
  voice: { freq: number; duration: number };
}

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  rabbit: {
    id: 'rabbit',
    weight: 1,
    label: 'Rabbit',
    palette: { body: '#f4f1ea', accent: '#e8b9c6', belly: '#ffffff' },
    voice: { freq: 1180, duration: 0.08 },
  },
  cat: {
    id: 'cat',
    weight: 2,
    label: 'Cat',
    palette: { body: '#f6a96b', accent: '#d9814a', belly: '#ffe3c8' },
    voice: { freq: 880, duration: 0.1 },
  },
  dog: {
    id: 'dog',
    weight: 3,
    label: 'Dog',
    palette: { body: '#b98a5c', accent: '#8d6440', belly: '#f0dcc2' },
    voice: { freq: 560, duration: 0.12 },
  },
  bear: {
    id: 'bear',
    weight: 5,
    label: 'Bear',
    palette: { body: '#8d6e63', accent: '#5f4a42', belly: '#d7bfa6' },
    voice: { freq: 320, duration: 0.16 },
  },
};

/** Lightest first: the order the tray and any picker should show. */
export const ANIMAL_IDS: readonly AnimalId[] = ['rabbit', 'cat', 'dog', 'bear'];

export const weightOf = (id: AnimalId): number => ANIMALS[id].weight;
