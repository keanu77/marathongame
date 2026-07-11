import { describe, expect, it } from 'vitest';

import type { PlayerAnimationState } from '../types';
import {
  getRunnerAnimationFrame,
  getRunnerJumpFrame,
  RUNNER_ANIMATION_SPECS,
  RUNNER_JUMP_PHASE_SPECS,
  RUNNER_SPRITE_SHEET,
  type RunnerAirPhase,
} from './runnerAnimationConfig';

const STATES: readonly PlayerAnimationState[] = [
  'idle',
  'running',
  'jumping',
  'hurt',
  'finished',
  'gameOver',
];

describe('runner animation configuration', () => {
  it('assigns every sprite-sheet frame exactly once', () => {
    const allFrames = STATES.flatMap((state) => RUNNER_ANIMATION_SPECS[state].frames);

    expect(RUNNER_ANIMATION_SPECS.idle.frames).toHaveLength(6);
    expect(RUNNER_ANIMATION_SPECS.running.frames).toHaveLength(16);
    expect(RUNNER_ANIMATION_SPECS.jumping.frames).toHaveLength(8);
    expect(RUNNER_ANIMATION_SPECS.hurt.frames).toHaveLength(4);
    expect(RUNNER_ANIMATION_SPECS.finished.frames).toHaveLength(8);
    expect(RUNNER_ANIMATION_SPECS.gameOver.frames).toHaveLength(6);
    expect(new Set(allFrames).size).toBe(RUNNER_SPRITE_SHEET.frameCount);
    expect(allFrames).toEqual(
      Array.from({ length: RUNNER_SPRITE_SHEET.frameCount }, (_, index) => index),
    );
  });

  it('declares the intended playback modes and running cadence', () => {
    expect(RUNNER_ANIMATION_SPECS.idle.playback).toBe('loop');
    expect(RUNNER_ANIMATION_SPECS.running).toMatchObject({
      durationMs: 660,
      playback: 'loop',
    });
    expect(RUNNER_ANIMATION_SPECS.jumping.playback).toBe('phase');
    expect(RUNNER_ANIMATION_SPECS.hurt.playback).toBe('loop');
    expect(RUNNER_ANIMATION_SPECS.finished.playback).toBe('hold');
    expect(RUNNER_ANIMATION_SPECS.gameOver.playback).toBe('hold');
  });

  it('keeps enough atlas headroom while preserving the gameplay foot baseline', () => {
    const physicalOriginY =
      RUNNER_SPRITE_SHEET.footBaselineY -
      RUNNER_SPRITE_SHEET.localFootBaselineY / RUNNER_SPRITE_SHEET.displayScale;

    expect(physicalOriginY).toBe(124);
    expect(
      RUNNER_SPRITE_SHEET.frameHeight - RUNNER_SPRITE_SHEET.footBaselineY,
    ).toBeGreaterThanOrEqual(12);
  });
});

describe('getRunnerAnimationFrame', () => {
  it('loops running frames at exact 660 ms boundaries', () => {
    const firstFrame = RUNNER_ANIMATION_SPECS.running.frames[0];
    const lastFrame = RUNNER_ANIMATION_SPECS.running.frames.at(-1);
    const frameDurationMs = 660 / 16;

    expect(getRunnerAnimationFrame('running', 0)).toBe(firstFrame);
    expect(getRunnerAnimationFrame('running', frameDurationMs - 0.001)).toBe(firstFrame);
    expect(getRunnerAnimationFrame('running', frameDurationMs)).toBe(firstFrame + 1);
    expect(getRunnerAnimationFrame('running', 660 - 0.001)).toBe(lastFrame);
    expect(getRunnerAnimationFrame('running', 660)).toBe(firstFrame);
    expect(getRunnerAnimationFrame('running', 1_320)).toBe(firstFrame);
  });

  it('loops idle breathing and hurt feedback at their cycle boundaries', () => {
    expect(getRunnerAnimationFrame('idle', 0)).toBe(0);
    expect(getRunnerAnimationFrame('idle', 1_200)).toBe(0);
    expect(getRunnerAnimationFrame('hurt', 0)).toBe(30);
    expect(getRunnerAnimationFrame('hurt', 320)).toBe(30);
  });

  it('holds terminal animations on their final frame', () => {
    expect(getRunnerAnimationFrame('finished', 0)).toBe(34);
    expect(getRunnerAnimationFrame('finished', 90)).toBe(35);
    expect(getRunnerAnimationFrame('finished', 720 - 0.001)).toBe(41);
    expect(getRunnerAnimationFrame('finished', 720)).toBe(41);
    expect(getRunnerAnimationFrame('finished', 100_000)).toBe(41);

    expect(getRunnerAnimationFrame('gameOver', 0)).toBe(42);
    expect(getRunnerAnimationFrame('gameOver', 600)).toBe(47);
    expect(getRunnerAnimationFrame('gameOver', 100_000)).toBe(47);
  });

  it('normalizes negative and non-finite elapsed times to the first pose', () => {
    for (const elapsedMs of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(getRunnerAnimationFrame('running', elapsedMs)).toBe(6);
      expect(getRunnerAnimationFrame('finished', elapsedMs)).toBe(34);
      expect(getRunnerJumpFrame('takeoff', elapsedMs)).toBe(22);
    }
  });

  it('falls back safely if an unknown runtime state reaches the resolver', () => {
    expect(getRunnerAnimationFrame('unknown' as PlayerAnimationState, 0)).toBe(0);
  });
});

describe('getRunnerJumpFrame', () => {
  it('maps takeoff, ascent, apex and descent to separate frame pairs', () => {
    const phases: readonly RunnerAirPhase[] = ['takeoff', 'ascent', 'apex', 'descent'];
    const allPhaseFrames = phases.flatMap((phase) => RUNNER_JUMP_PHASE_SPECS[phase].frames);

    expect(allPhaseFrames).toEqual(RUNNER_ANIMATION_SPECS.jumping.frames);

    for (const phase of phases) {
      const spec = RUNNER_JUMP_PHASE_SPECS[phase];
      const firstFrame = spec.frames[0];
      const lastFrame = spec.frames.at(-1);
      const frameDurationMs = spec.durationMs / spec.frames.length;

      expect(getRunnerJumpFrame(phase)).toBe(firstFrame);
      expect(getRunnerJumpFrame(phase, frameDurationMs)).toBe(lastFrame);
      expect(getRunnerJumpFrame(phase, spec.durationMs)).toBe(lastFrame);
      expect(getRunnerJumpFrame(phase, 10_000)).toBe(lastFrame);
    }
  });

  it('uses the apex pose for an unknown runtime phase', () => {
    expect(getRunnerJumpFrame('unknown' as RunnerAirPhase)).toBe(
      RUNNER_JUMP_PHASE_SPECS.apex.frames[0],
    );
  });
});
