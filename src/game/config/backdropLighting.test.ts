import { describe, expect, it } from 'vitest';

import { getBackdropLighting, normalizeBackdropProgress } from './backdropLighting';

describe('normalizeBackdropProgress', () => {
  it.each([
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [-0.4, 0],
    [0.35, 0.35],
    [1.8, 1],
  ])('normalizes %s to %s', (progress, expected) => {
    expect(normalizeBackdropProgress(progress)).toBe(expected);
  });
});

describe('getBackdropLighting', () => {
  it('keeps base and race in their own stable morning palettes', () => {
    const baseStart = getBackdropLighting('base', 0);
    const baseEnd = getBackdropLighting('base', 1);
    const raceStart = getBackdropLighting('race', 0);
    const raceEnd = getBackdropLighting('race', 1);

    expect({ ...baseStart, normalizedProgress: 0 }).toEqual({
      ...baseEnd,
      normalizedProgress: 0,
    });
    expect({ ...raceStart, normalizedProgress: 0 }).toEqual({
      ...raceEnd,
      normalizedProgress: 0,
    });
    expect(baseStart).toMatchObject({
      sunAlpha: 0.94,
      moonAlpha: 0,
      starsAlpha: 0,
      nightOverlayAlpha: 0,
    });
    expect(raceStart).toMatchObject({
      sunAlpha: 0.96,
      moonAlpha: 0,
      starsAlpha: 0,
      nightOverlayAlpha: 0,
    });
    expect(raceStart.skyTop).not.toBe(baseStart.skyTop);
  });

  it('keeps the first 20% of build visibly afternoon and the final 25% night', () => {
    const afternoon = getBackdropLighting('build', 0.2);
    const nightStart = getBackdropLighting('build', 0.75);
    const fullNight = getBackdropLighting('build', 1);

    expect(afternoon).toMatchObject({
      moonAlpha: 0,
      starsAlpha: 0,
      nightOverlayAlpha: 0,
    });
    expect(afternoon.sunAlpha).toBeGreaterThanOrEqual(0.9);
    expect(nightStart.sunAlpha).toBeLessThanOrEqual(0.08);
    expect(nightStart.moonAlpha).toBeGreaterThanOrEqual(0.7);
    expect(nightStart.starsAlpha).toBeGreaterThanOrEqual(0.6);
    expect(nightStart.nightOverlayAlpha).toBeGreaterThanOrEqual(0.2);
    expect(fullNight.moonAlpha).toBeGreaterThan(nightStart.moonAlpha);
    expect(fullNight.starsAlpha).toBeGreaterThan(nightStart.starsAlpha);
  });

  it('smoothly interpolates build colors instead of snapping at keyframe boundaries', () => {
    const beforeDusk = getBackdropLighting('build', 0.49);
    const nearDusk = getBackdropLighting('build', 0.5);
    const afterDusk = getBackdropLighting('build', 0.51);

    expect(nearDusk.skyTop).not.toBe(beforeDusk.skyTop);
    expect(afterDusk.skyTop).not.toBe(nearDusk.skyTop);
    expect(nearDusk.sunAlpha).toBeLessThan(beforeDusk.sunAlpha);
    expect(afterDusk.sunAlpha).toBeLessThan(nearDusk.sunAlpha);
    expect(nearDusk.moonAlpha).toBeGreaterThan(beforeDusk.moonAlpha);
    expect(afterDusk.moonAlpha).toBeGreaterThan(nearDusk.moonAlpha);
  });

  it('increases build moon, stars and night overlay monotonically', () => {
    const samples = Array.from({ length: 101 }, (_, index) =>
      getBackdropLighting('build', index / 100),
    );

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].moonAlpha).toBeGreaterThanOrEqual(samples[index - 1].moonAlpha);
      expect(samples[index].starsAlpha).toBeGreaterThanOrEqual(samples[index - 1].starsAlpha);
      expect(samples[index].nightOverlayAlpha).toBeGreaterThanOrEqual(
        samples[index - 1].nightOverlayAlpha,
      );
    }
  });

  it('returns the normalized progress with every lighting result', () => {
    expect(getBackdropLighting('build', Number.NaN).normalizedProgress).toBe(0);
    expect(getBackdropLighting('build', -10).normalizedProgress).toBe(0);
    expect(getBackdropLighting('build', 10).normalizedProgress).toBe(1);
  });
});
