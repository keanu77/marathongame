import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    GameObjects: { Container: class {} },
  },
}));

import {
  getRunnerAirPhase,
  getRunnerLandingCompression,
  getRunnerResumeAnimationElapsed,
  getRunnerRunCyclePhase,
  RUNNER_ANIMATION_TIMING,
} from './Player';

describe('Player motion design', () => {
  it('uses a natural distance-running cadence and loops without drift', () => {
    const stepsPerMinute = (60_000 / RUNNER_ANIMATION_TIMING.runCycleMs) * 2;

    expect(stepsPerMinute).toBeGreaterThanOrEqual(175);
    expect(stepsPerMinute).toBeLessThanOrEqual(190);
    expect(getRunnerRunCyclePhase(0)).toBe(0);
    expect(getRunnerRunCyclePhase(RUNNER_ANIMATION_TIMING.runCycleMs / 2)).toBeCloseTo(0.5);
    expect(getRunnerRunCyclePhase(RUNNER_ANIMATION_TIMING.runCycleMs)).toBe(0);
    expect(getRunnerRunCyclePhase(Number.NaN)).toBe(0);
  });

  it('separates anticipation, ascent, apex and descent silhouettes', () => {
    const afterTakeoff = RUNNER_ANIMATION_TIMING.takeoffExtensionMs;

    expect(getRunnerAirPhase(-720, 0)).toBe('takeoff');
    expect(getRunnerAirPhase(-720, afterTakeoff - 1)).toBe('takeoff');
    expect(getRunnerAirPhase(-720, afterTakeoff)).toBe('ascent');
    expect(getRunnerAirPhase(-100, 0)).toBe('apex');
    expect(getRunnerAirPhase(100, 0)).toBe('apex');
    expect(getRunnerAirPhase(720, 0)).toBe('descent');
    expect(RUNNER_ANIMATION_TIMING.takeoffExtensionMs).toBeLessThanOrEqual(50);
  });

  it('does not replay toe-off after an airborne hurt state', () => {
    const resumedElapsed = getRunnerResumeAnimationElapsed('jumping');

    expect(resumedElapsed).toBe(RUNNER_ANIMATION_TIMING.takeoffExtensionMs);
    expect(getRunnerAirPhase(-500, resumedElapsed)).toBe('ascent');
    expect(getRunnerAirPhase(500, resumedElapsed)).toBe('descent');
    expect(getRunnerResumeAnimationElapsed('running')).toBe(0);
  });

  it('normalizes landing compression to a short, bounded recovery', () => {
    expect(getRunnerLandingCompression(RUNNER_ANIMATION_TIMING.landingCompressionMs)).toBe(1);
    expect(getRunnerLandingCompression(RUNNER_ANIMATION_TIMING.landingCompressionMs / 2)).toBe(0.5);
    expect(getRunnerLandingCompression(0)).toBe(0);
    expect(getRunnerLandingCompression(-100)).toBe(0);
    expect(getRunnerLandingCompression(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
