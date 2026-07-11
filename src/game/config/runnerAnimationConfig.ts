import type { PlayerAnimationState } from '../types';

export type RunnerAnimationState = PlayerAnimationState;

export type RunnerAnimationPlayback = 'loop' | 'hold' | 'phase';

export type RunnerAirPhase = 'takeoff' | 'ascent' | 'apex' | 'descent';

export interface RunnerAnimationSpec {
  readonly state: PlayerAnimationState;
  readonly frames: readonly number[];
  /** Total playback time for timed animations; phase-driven jumping uses null. */
  readonly durationMs: number | null;
  readonly playback: RunnerAnimationPlayback;
}

export interface RunnerJumpPhaseSpec {
  readonly phase: RunnerAirPhase;
  readonly frames: readonly number[];
  /** Time from the first pose to the held final pose for this phase. */
  readonly durationMs: number;
}

export const RUNNER_SPRITE_SHEET = {
  textureKey: 'marathon-runner',
  assetPath: 'assets/runner/runner-spritesheet.png',
  frameWidth: 192,
  frameHeight: 224,
  columns: 8,
  rows: 6,
  frameCount: 48,
  displayScale: 0.5,
  anchorX: 96,
  // Lower in-frame placement leaves enough headroom for forward lean and
  // raised-arm celebration poses without clipping into adjacent atlas cells.
  footBaselineY: 210,
  localFootBaselineY: 43,
} as const;

const frames = (firstFrame: number, frameCount: number): readonly number[] =>
  Object.freeze(Array.from({ length: frameCount }, (_, index) => firstFrame + index));

const IDLE_FRAMES = frames(0, 6);
const RUNNING_FRAMES = frames(6, 16);
const JUMPING_FRAMES = frames(22, 8);
const HURT_FRAMES = frames(30, 4);
const FINISHED_FRAMES = frames(34, 8);
const GAME_OVER_FRAMES = frames(42, 6);

/**
 * Sprite-sheet contract shared by the renderer and tests. Frame ranges are
 * contiguous so an exported sheet can be audited without Phaser.
 */
export const RUNNER_ANIMATION_SPECS: Readonly<Record<PlayerAnimationState, RunnerAnimationSpec>> =
  Object.freeze({
    idle: {
      state: 'idle',
      frames: IDLE_FRAMES,
      durationMs: 1_200,
      playback: 'loop',
    },
    running: {
      state: 'running',
      frames: RUNNING_FRAMES,
      durationMs: 660,
      playback: 'loop',
    },
    jumping: {
      state: 'jumping',
      frames: JUMPING_FRAMES,
      durationMs: null,
      playback: 'phase',
    },
    hurt: {
      state: 'hurt',
      frames: HURT_FRAMES,
      durationMs: 320,
      playback: 'loop',
    },
    finished: {
      state: 'finished',
      frames: FINISHED_FRAMES,
      durationMs: 720,
      playback: 'hold',
    },
    gameOver: {
      state: 'gameOver',
      frames: GAME_OVER_FRAMES,
      durationMs: 600,
      playback: 'hold',
    },
  });

export const RUNNER_JUMP_PHASE_SPECS: Readonly<Record<RunnerAirPhase, RunnerJumpPhaseSpec>> =
  Object.freeze({
    takeoff: {
      phase: 'takeoff',
      frames: Object.freeze([JUMPING_FRAMES[0], JUMPING_FRAMES[1]]),
      durationMs: 45,
    },
    ascent: {
      phase: 'ascent',
      frames: Object.freeze([JUMPING_FRAMES[2], JUMPING_FRAMES[3]]),
      durationMs: 180,
    },
    apex: {
      phase: 'apex',
      frames: Object.freeze([JUMPING_FRAMES[4], JUMPING_FRAMES[5]]),
      durationMs: 140,
    },
    descent: {
      phase: 'descent',
      frames: Object.freeze([JUMPING_FRAMES[6], JUMPING_FRAMES[7]]),
      durationMs: 180,
    },
  });

function normalizeElapsedMs(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
}

function getLoopFrameIndex(
  frameIndices: readonly number[],
  durationMs: number,
  elapsedMs: number,
): number {
  const elapsedInCycle = normalizeElapsedMs(elapsedMs) % durationMs;
  const frameDurationMs = durationMs / frameIndices.length;
  const localFrameIndex = Math.min(
    frameIndices.length - 1,
    Math.floor(elapsedInCycle / frameDurationMs),
  );
  return frameIndices[localFrameIndex];
}

function getHoldFrameIndex(
  frameIndices: readonly number[],
  durationMs: number,
  elapsedMs: number,
): number {
  const frameDurationMs = durationMs / frameIndices.length;
  const localFrameIndex = Math.min(
    frameIndices.length - 1,
    Math.floor(normalizeElapsedMs(elapsedMs) / frameDurationMs),
  );
  return frameIndices[localFrameIndex];
}

/**
 * Resolves a jump pose. `phaseElapsedMs` starts at zero whenever the airborne
 * phase changes; the last pose is held until physics selects the next phase.
 */
export function getRunnerJumpFrame(phase: RunnerAirPhase, phaseElapsedMs = 0): number {
  const spec = RUNNER_JUMP_PHASE_SPECS[phase] ?? RUNNER_JUMP_PHASE_SPECS.apex;
  return getHoldFrameIndex(spec.frames, spec.durationMs, phaseElapsedMs);
}

/**
 * Pure state-to-frame resolver for the six public runner states. Jumping uses
 * the apex pair as a neutral fallback; the renderer should call
 * `getRunnerJumpFrame` when it has a physics-derived airborne phase.
 */
export function getRunnerAnimationFrame(state: RunnerAnimationState, elapsedMs: number): number {
  const spec = RUNNER_ANIMATION_SPECS[state] ?? RUNNER_ANIMATION_SPECS.idle;

  if (spec.playback === 'phase') {
    return getRunnerJumpFrame('apex', elapsedMs);
  }

  if (spec.playback === 'loop') {
    return getLoopFrameIndex(spec.frames, spec.durationMs ?? 1, elapsedMs);
  }

  return getHoldFrameIndex(spec.frames, spec.durationMs ?? 1, elapsedMs);
}
