import type { MarathonStageId } from '../types';

export type MusicWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type MusicMood = 'upbeat' | 'accelerating' | 'excited';

export interface PercussionVoiceConfig {
  /** One loop contains 16 eighth-note steps. A true step triggers this voice. */
  readonly pattern: readonly boolean[];
  readonly wave: MusicWaveform;
  readonly startFrequencyHz: number;
  readonly endFrequencyHz: number;
  readonly volume: number;
  readonly durationSeconds: number;
}

export interface StageMusicConfig {
  readonly label: string;
  readonly mood: MusicMood;
  readonly bpm: number;
  /** One loop contains 16 eighth-note steps. null represents a rest. */
  readonly melodyHz: readonly (number | null)[];
  /** One loop contains 16 eighth-note steps. null represents a rest. */
  readonly bassHz: readonly (number | null)[];
  /** Low kick and high accent are synthesized independently for a clearer groove. */
  readonly kick: PercussionVoiceConfig;
  readonly accent: PercussionVoiceConfig;
  readonly melodyWave: MusicWaveform;
  readonly bassWave: MusicWaveform;
  readonly melodyVolume: number;
  readonly bassVolume: number;
  readonly melodyDurationSteps: number;
  readonly bassDurationSteps: number;
}

export interface MusicEngineConfig {
  readonly stepsPerBeat: number;
  readonly schedulerIntervalMs: number;
  readonly scheduleAheadSeconds: number;
  readonly crossfadeSeconds: number;
  readonly pauseFadeSeconds: number;
}

/** Shared scheduler timing and fade values for the Web Audio engine. */
export const MUSIC_ENGINE_CONFIG = {
  stepsPerBeat: 2,
  schedulerIntervalMs: 50,
  scheduleAheadSeconds: 0.2,
  crossfadeSeconds: 0.35,
  pauseFadeSeconds: 0.1,
} as const satisfies MusicEngineConfig;

/**
 * Three original procedural loops assembled from simple chord tones. They use
 * no recordings, samples, downloaded music, or melodies adapted from a song.
 * Each stage has an original two-bar groove. Later stages gain tempo, note
 * density, brighter timbres, and stronger off-beat accents without relying on
 * a volume jump.
 */
export const STAGE_MUSIC_CONFIG = {
  base: {
    label: '有節奏',
    mood: 'upbeat',
    bpm: 130,
    melodyHz: [
      261.63,
      null,
      329.63,
      392,
      null,
      293.66,
      329.63,
      null,
      392,
      null,
      440,
      392,
      329.63,
      293.66,
      261.63,
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
      123.47,
      116.54,
      null,
      null,
      null,
      98,
      null,
      null,
      123.47,
    ],
    kick: {
      pattern: [
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
      wave: 'sine',
      startFrequencyHz: 112,
      endFrequencyHz: 58,
      volume: 0.023,
      durationSeconds: 0.09,
    },
    accent: {
      pattern: [
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
        true,
        false,
      ],
      wave: 'triangle',
      startFrequencyHz: 920,
      endFrequencyHz: 620,
      volume: 0.009,
      durationSeconds: 0.045,
    },
    melodyWave: 'triangle',
    bassWave: 'sine',
    melodyVolume: 0.027,
    bassVolume: 0.032,
    melodyDurationSteps: 0.82,
    bassDurationSteps: 1.35,
  },
  build: {
    label: '加速',
    mood: 'accelerating',
    bpm: 150,
    melodyHz: [
      293.66,
      369.99,
      440,
      null,
      369.99,
      440,
      493.88,
      440,
      493.88,
      587.33,
      493.88,
      587.33,
      659.25,
      null,
      587.33,
      739.99,
    ],
    bassHz: [
      146.83,
      null,
      146.83,
      null,
      123.47,
      null,
      146.83,
      null,
      110,
      null,
      123.47,
      null,
      123.47,
      null,
      138.59,
      146.83,
    ],
    kick: {
      pattern: [
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
      wave: 'triangle',
      startFrequencyHz: 132,
      endFrequencyHz: 54,
      volume: 0.022,
      durationSeconds: 0.078,
    },
    accent: {
      pattern: [
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
        true,
      ],
      wave: 'square',
      startFrequencyHz: 1_360,
      endFrequencyHz: 720,
      volume: 0.007,
      durationSeconds: 0.035,
    },
    melodyWave: 'triangle',
    bassWave: 'square',
    melodyVolume: 0.025,
    bassVolume: 0.029,
    melodyDurationSteps: 0.62,
    bassDurationSteps: 0.92,
  },
  race: {
    label: '熱血',
    mood: 'excited',
    bpm: 170,
    melodyHz: [
      329.63, 392, 440, 493.88, 587.33, 493.88, 659.25, 587.33, 392, 440, 493.88, 587.33, 659.25,
      783.99, 659.25, 587.33,
    ],
    bassHz: [
      82.41,
      null,
      82.41,
      123.47,
      123.47,
      null,
      98,
      98,
      123.47,
      110,
      null,
      110,
      123.47,
      146.83,
      123.47,
      146.83,
    ],
    kick: {
      pattern: [
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        true,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        true,
      ],
      wave: 'square',
      startFrequencyHz: 154,
      endFrequencyHz: 48,
      volume: 0.019,
      durationSeconds: 0.068,
    },
    accent: {
      pattern: [
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
        true,
      ],
      wave: 'square',
      startFrequencyHz: 1_920,
      endFrequencyHz: 880,
      volume: 0.006,
      durationSeconds: 0.028,
    },
    melodyWave: 'sawtooth',
    bassWave: 'square',
    melodyVolume: 0.019,
    bassVolume: 0.026,
    melodyDurationSteps: 0.46,
    bassDurationSteps: 0.72,
  },
} as const satisfies Readonly<Record<MarathonStageId, StageMusicConfig>>;
