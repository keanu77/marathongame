import type { MarathonStageId } from '../types';

export type MusicWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type MusicMood = 'upbeat' | 'accelerating' | 'excited';

export interface StageMusicConfig {
  readonly label: string;
  readonly mood: MusicMood;
  readonly bpm: number;
  /** One loop contains 16 eighth-note steps. null represents a rest. */
  readonly melodyHz: readonly (number | null)[];
  /** One loop contains 16 eighth-note steps. null represents a rest. */
  readonly bassHz: readonly (number | null)[];
  /** A true step triggers the short procedural beat voice. */
  readonly beatPattern: readonly boolean[];
  readonly melodyWave: MusicWaveform;
  readonly bassWave: MusicWaveform;
  readonly melodyVolume: number;
  readonly bassVolume: number;
  readonly beatVolume: number;
  readonly melodyDurationSteps: number;
  readonly bassDurationSteps: number;
}

export interface MusicEngineConfig {
  readonly stepsPerBeat: number;
  readonly schedulerIntervalMs: number;
  readonly scheduleAheadSeconds: number;
  readonly crossfadeSeconds: number;
  readonly pauseFadeSeconds: number;
  readonly beatStartFrequencyHz: number;
  readonly beatEndFrequencyHz: number;
  readonly beatDurationSeconds: number;
}

/** Shared timing and beat-envelope values for the Web Audio scheduler. */
export const MUSIC_ENGINE_CONFIG = {
  stepsPerBeat: 2,
  schedulerIntervalMs: 50,
  scheduleAheadSeconds: 0.2,
  crossfadeSeconds: 0.35,
  pauseFadeSeconds: 0.1,
  beatStartFrequencyHz: 120,
  beatEndFrequencyHz: 55,
  beatDurationSeconds: 0.09,
} as const satisfies MusicEngineConfig;

/**
 * Three original procedural loops assembled from simple chord tones. They use
 * no recordings, samples, downloaded music, or melodies adapted from a song.
 * Later stages gain tempo and note density without relying on a volume jump.
 */
export const STAGE_MUSIC_CONFIG = {
  base: {
    label: '輕快',
    mood: 'upbeat',
    bpm: 120,
    melodyHz: [
      261.63,
      null,
      null,
      329.63,
      null,
      392,
      null,
      null,
      293.66,
      null,
      null,
      349.23,
      null,
      440,
      null,
      null,
    ],
    bassHz: [
      130.81,
      null,
      null,
      null,
      110,
      null,
      null,
      null,
      116.54,
      null,
      null,
      null,
      98,
      null,
      null,
      null,
    ],
    beatPattern: [
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ],
    melodyWave: 'triangle',
    bassWave: 'sine',
    melodyVolume: 0.03,
    bassVolume: 0.034,
    beatVolume: 0.02,
    melodyDurationSteps: 1.45,
    bassDurationSteps: 1.8,
  },
  build: {
    label: '加速',
    mood: 'accelerating',
    bpm: 140,
    melodyHz: [
      293.66,
      null,
      369.99,
      440,
      493.88,
      null,
      440,
      null,
      369.99,
      440,
      493.88,
      null,
      587.33,
      null,
      493.88,
      440,
    ],
    bassHz: [
      146.83,
      null,
      null,
      null,
      123.47,
      null,
      146.83,
      null,
      110,
      null,
      null,
      null,
      123.47,
      null,
      138.59,
      null,
    ],
    beatPattern: [
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ],
    melodyWave: 'triangle',
    bassWave: 'sine',
    melodyVolume: 0.028,
    bassVolume: 0.032,
    beatVolume: 0.021,
    melodyDurationSteps: 0.72,
    bassDurationSteps: 1.15,
  },
  race: {
    label: '熱血興奮',
    mood: 'excited',
    bpm: 160,
    melodyHz: [
      329.63, 392, 440, 493.88, 587.33, 493.88, 440, 523.25, 392, 440, 493.88, 587.33, 659.25,
      587.33, 493.88, 392,
    ],
    bassHz: [
      82.41,
      null,
      82.41,
      null,
      123.47,
      null,
      123.47,
      null,
      98,
      null,
      98,
      null,
      110,
      null,
      123.47,
      null,
    ],
    beatPattern: [
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ],
    melodyWave: 'sawtooth',
    bassWave: 'square',
    melodyVolume: 0.02,
    bassVolume: 0.028,
    beatVolume: 0.02,
    melodyDurationSteps: 0.48,
    bassDurationSteps: 0.82,
  },
} as const satisfies Readonly<Record<MarathonStageId, StageMusicConfig>>;
