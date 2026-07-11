import type { MarathonStageId } from '../types';

export interface BackdropLighting {
  readonly skyTop: number;
  readonly skyBottom: number;
  readonly sun: number;
  readonly sunGlow: number;
  readonly horizon: number;
  readonly horizonAccent: number;
  readonly sunAlpha: number;
  readonly moonAlpha: number;
  readonly starsAlpha: number;
  readonly nightOverlayAlpha: number;
  readonly normalizedProgress: number;
}

type LightingKeyframe = Omit<BackdropLighting, 'normalizedProgress'>;

interface TimedLightingKeyframe {
  readonly at: number;
  readonly lighting: LightingKeyframe;
}

const BASE_MORNING: LightingKeyframe = {
  skyTop: 0x74d4e8,
  skyBottom: 0xf8edc4,
  sun: 0xffc857,
  sunGlow: 0xffe7a0,
  horizon: 0x276d61,
  horizonAccent: 0x86c96c,
  sunAlpha: 0.94,
  moonAlpha: 0,
  starsAlpha: 0,
  nightOverlayAlpha: 0,
};

const RACE_MORNING: LightingKeyframe = {
  skyTop: 0x62c9e8,
  skyBottom: 0xffdfa3,
  sun: 0xffad4f,
  sunGlow: 0xffda86,
  horizon: 0x326f72,
  horizonAccent: 0xf1b95c,
  sunAlpha: 0.96,
  moonAlpha: 0,
  starsAlpha: 0,
  nightOverlayAlpha: 0,
};

/**
 * 進階期在前 20% 保持明亮午後，之後經黃昏逐步入夜；75% 起已是明顯夜景。
 * alpha 欄位刻意保持單調，避免月亮、星光或夜色在進度前進時反向跳動。
 */
const BUILD_LIGHTING_KEYFRAMES: readonly TimedLightingKeyframe[] = [
  {
    at: 0,
    lighting: {
      skyTop: 0x56b8e5,
      skyBottom: 0xf6d58f,
      sun: 0xffcb62,
      sunGlow: 0xffe5a8,
      horizon: 0x2f6b82,
      horizonAccent: 0x79c5d8,
      sunAlpha: 0.94,
      moonAlpha: 0,
      starsAlpha: 0,
      nightOverlayAlpha: 0,
    },
  },
  {
    at: 0.2,
    lighting: {
      skyTop: 0x4fa9dd,
      skyBottom: 0xf4c681,
      sun: 0xffbd57,
      sunGlow: 0xffdc98,
      horizon: 0x35677e,
      horizonAccent: 0x77b9c9,
      sunAlpha: 0.9,
      moonAlpha: 0,
      starsAlpha: 0,
      nightOverlayAlpha: 0,
    },
  },
  {
    at: 0.55,
    lighting: {
      skyTop: 0x5b5d99,
      skyBottom: 0xf49370,
      sun: 0xff984d,
      sunGlow: 0xffbd78,
      horizon: 0x463f62,
      horizonAccent: 0xcf7475,
      sunAlpha: 0.48,
      moonAlpha: 0.16,
      starsAlpha: 0.12,
      nightOverlayAlpha: 0.08,
    },
  },
  {
    at: 0.75,
    lighting: {
      skyTop: 0x17335d,
      skyBottom: 0x5b6385,
      sun: 0xe98962,
      sunGlow: 0xcf987b,
      horizon: 0x24364f,
      horizonAccent: 0x536c83,
      sunAlpha: 0.08,
      moonAlpha: 0.72,
      starsAlpha: 0.62,
      nightOverlayAlpha: 0.24,
    },
  },
  {
    at: 1,
    lighting: {
      skyTop: 0x071a3b,
      skyBottom: 0x263b68,
      sun: 0xcd8066,
      sunGlow: 0xb1857c,
      horizon: 0x14273f,
      horizonAccent: 0x3e617e,
      sunAlpha: 0,
      moonAlpha: 0.96,
      starsAlpha: 0.92,
      nightOverlayAlpha: 0.36,
    },
  },
] as const;

const COLOR_FIELDS = [
  'skyTop',
  'skyBottom',
  'sun',
  'sunGlow',
  'horizon',
  'horizonAccent',
] as const satisfies readonly (keyof LightingKeyframe)[];

const ALPHA_FIELDS = [
  'sunAlpha',
  'moonAlpha',
  'starsAlpha',
  'nightOverlayAlpha',
] as const satisfies readonly (keyof LightingKeyframe)[];

export function normalizeBackdropProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function interpolateNumber(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolateColor(start: number, end: number, progress: number): number {
  const red = Math.round(interpolateNumber((start >> 16) & 0xff, (end >> 16) & 0xff, progress));
  const green = Math.round(interpolateNumber((start >> 8) & 0xff, (end >> 8) & 0xff, progress));
  const blue = Math.round(interpolateNumber(start & 0xff, end & 0xff, progress));

  return (red << 16) | (green << 8) | blue;
}

function interpolateLighting(
  start: LightingKeyframe,
  end: LightingKeyframe,
  progress: number,
): LightingKeyframe {
  const easedProgress = smoothstep(progress);
  const result = {} as Record<keyof LightingKeyframe, number>;

  for (const field of COLOR_FIELDS) {
    result[field] = interpolateColor(start[field], end[field], easedProgress);
  }

  for (const field of ALPHA_FIELDS) {
    result[field] = interpolateNumber(start[field], end[field], easedProgress);
  }

  return result;
}

function getBuildLighting(progress: number): LightingKeyframe {
  for (let index = 1; index < BUILD_LIGHTING_KEYFRAMES.length; index += 1) {
    const next = BUILD_LIGHTING_KEYFRAMES[index];

    if (progress <= next.at) {
      if (progress === next.at) return next.lighting;

      const previous = BUILD_LIGHTING_KEYFRAMES[index - 1];
      const segmentProgress = (progress - previous.at) / (next.at - previous.at);
      return interpolateLighting(previous.lighting, next.lighting, segmentProgress);
    }
  }

  return BUILD_LIGHTING_KEYFRAMES.at(-1)!.lighting;
}

/**
 * Resolves code-native lighting for the active marathon stage.
 * Base and race are stable morning scenes; build advances from afternoon to night.
 */
export function getBackdropLighting(stageId: MarathonStageId, progress: number): BackdropLighting {
  const normalizedProgress = normalizeBackdropProgress(progress);
  const lighting =
    stageId === 'build'
      ? getBuildLighting(normalizedProgress)
      : stageId === 'race'
        ? RACE_MORNING
        : BASE_MORNING;

  return { ...lighting, normalizedProgress };
}
