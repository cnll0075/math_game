/**
 * A named set of sounds. Games play events by name, so the synthesised
 * prototype pack can be swapped for recorded samples without touching
 * gameplay code.
 */
export interface SoundPack {
  preload(): Promise<void>;
  play(event: string, params?: Record<string, number>): void;
}
