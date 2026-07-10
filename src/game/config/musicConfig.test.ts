import { describe, expect, it } from 'vitest';

import { MARATHON_STAGE_IDS } from '../types';
import { MUSIC_ENGINE_CONFIG, STAGE_MUSIC_CONFIG, type StageMusicConfig } from './musicConfig';

const tracks = MARATHON_STAGE_IDS.map((stageId) => STAGE_MUSIC_CONFIG[stageId]);

function countEvents(track: StageMusicConfig): number {
  return (
    track.melodyHz.filter((frequency) => frequency !== null).length +
    track.bassHz.filter((frequency) => frequency !== null).length +
    track.beatPattern.filter(Boolean).length
  );
}

describe('STAGE_MUSIC_CONFIG', () => {
  it('為三個階段提供不同的 16 步程序配樂', () => {
    expect(Object.keys(STAGE_MUSIC_CONFIG)).toEqual(MARATHON_STAGE_IDS);
    expect(tracks.map((track) => track.label)).toEqual(['輕快', '加速', '熱血興奮']);
    expect(tracks.map((track) => track.mood)).toEqual(['upbeat', 'accelerating', 'excited']);

    for (const track of tracks) {
      expect(track.melodyHz).toHaveLength(16);
      expect(track.bassHz).toHaveLength(16);
      expect(track.beatPattern).toHaveLength(16);
    }

    expect(STAGE_MUSIC_CONFIG.base.melodyHz).not.toEqual(STAGE_MUSIC_CONFIG.build.melodyHz);
    expect(STAGE_MUSIC_CONFIG.build.melodyHz).not.toEqual(STAGE_MUSIC_CONFIG.race.melodyHz);
  });

  it('從輕快、加速到熱血興奮逐階提高 BPM 與事件密度', () => {
    expect(tracks.map((track) => track.bpm)).toEqual([120, 140, 160]);
    expect(countEvents(STAGE_MUSIC_CONFIG.base)).toBeLessThan(
      countEvents(STAGE_MUSIC_CONFIG.build),
    );
    expect(countEvents(STAGE_MUSIC_CONFIG.build)).toBeLessThan(
      countEvents(STAGE_MUSIC_CONFIG.race),
    );
  });

  it('頻率、音量與音符長度保持在適合程序合成的安全範圍', () => {
    const validWaves = ['sine', 'triangle', 'square', 'sawtooth'];

    for (const track of tracks) {
      const frequencies = [...track.melodyHz, ...track.bassHz].filter(
        (frequency) => frequency !== null,
      );
      const stepSeconds = 60 / track.bpm / MUSIC_ENGINE_CONFIG.stepsPerBeat;
      const melodyDurationSeconds = track.melodyDurationSteps * stepSeconds;
      const bassDurationSeconds = track.bassDurationSteps * stepSeconds;

      expect(frequencies.length).toBeGreaterThan(0);
      for (const frequency of frequencies) {
        expect(Number.isFinite(frequency)).toBe(true);
        expect(frequency).toBeGreaterThanOrEqual(55);
        expect(frequency).toBeLessThanOrEqual(1_000);
      }

      expect(validWaves).toContain(track.melodyWave);
      expect(validWaves).toContain(track.bassWave);
      expect(track.melodyVolume).toBeGreaterThan(0);
      expect(track.bassVolume).toBeGreaterThan(0);
      expect(track.beatVolume).toBeGreaterThan(0);
      expect(track.melodyVolume + track.bassVolume + track.beatVolume).toBeLessThanOrEqual(0.1);
      expect(melodyDurationSeconds).toBeGreaterThanOrEqual(0.08);
      expect(melodyDurationSeconds).toBeLessThanOrEqual(1);
      expect(bassDurationSeconds).toBeGreaterThanOrEqual(0.08);
      expect(bassDurationSeconds).toBeLessThanOrEqual(1);
    }
  });

  it('排程預讀、跨關淡化與鼓點包絡設定皆為有限正數', () => {
    expect(MUSIC_ENGINE_CONFIG.stepsPerBeat).toBe(2);
    expect(MUSIC_ENGINE_CONFIG.schedulerIntervalMs).toBeGreaterThan(0);
    expect(MUSIC_ENGINE_CONFIG.scheduleAheadSeconds).toBeGreaterThan(
      MUSIC_ENGINE_CONFIG.schedulerIntervalMs / 1_000,
    );
    expect(MUSIC_ENGINE_CONFIG.crossfadeSeconds).toBeGreaterThanOrEqual(0.1);
    expect(MUSIC_ENGINE_CONFIG.crossfadeSeconds).toBeLessThanOrEqual(0.75);
    expect(MUSIC_ENGINE_CONFIG.pauseFadeSeconds).toBeGreaterThan(0);
    expect(MUSIC_ENGINE_CONFIG.beatStartFrequencyHz).toBeGreaterThan(
      MUSIC_ENGINE_CONFIG.beatEndFrequencyHz,
    );
    expect(MUSIC_ENGINE_CONFIG.beatEndFrequencyHz).toBeGreaterThan(0);
    expect(MUSIC_ENGINE_CONFIG.beatDurationSeconds).toBeGreaterThanOrEqual(0.04);
    expect(MUSIC_ENGINE_CONFIG.beatDurationSeconds).toBeLessThanOrEqual(0.2);
  });
});
