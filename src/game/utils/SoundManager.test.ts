import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundManager } from './SoundManager';

class FakeAudioParam {
  public value = 1;
  public readonly cancelScheduledValues = vi.fn();
  public readonly cancelAndHoldAtTime = vi.fn();
  public readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  public readonly exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeGainNode {
  public readonly gain = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeBiquadFilterNode {
  public type: BiquadFilterType = 'lowpass';
  public readonly frequency = new FakeAudioParam();
  public readonly Q = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeDynamicsCompressorNode {
  public readonly threshold = new FakeAudioParam();
  public readonly knee = new FakeAudioParam();
  public readonly ratio = new FakeAudioParam();
  public readonly attack = new FakeAudioParam();
  public readonly release = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeOscillatorNode {
  public type: OscillatorType = 'sine';
  public readonly frequency = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
  public readonly addEventListener = vi.fn();
}

class FakeAudioContext {
  public state: AudioContextState = 'suspended';
  public currentTime = 0;
  public readonly destination = {};
  public readonly gains: FakeGainNode[] = [];
  public readonly filters: FakeBiquadFilterNode[] = [];
  public readonly compressors: FakeDynamicsCompressorNode[] = [];
  public readonly oscillators: FakeOscillatorNode[] = [];
  public readonly resume = vi.fn(async () => {
    this.state = 'running';
  });
  public readonly close = vi.fn(async () => {
    this.state = 'closed';
  });

  public createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  public createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilterNode();
    this.filters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  public createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeDynamicsCompressorNode();
    this.compressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
  }
}

function createManager() {
  const context = new FakeAudioContext();
  const manager = new SoundManager({
    createAudioContext: () => context as unknown as AudioContext,
  });
  return { context, manager };
}

describe('SoundManager 三階段程式配樂', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('解鎖後會開始基礎期，相同關卡不會重複建立循環', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');

    expect(context.resume).toHaveBeenCalledOnce();
    expect(manager.getMusicState()).toEqual({
      stageId: 'base',
      isPlaying: true,
      isPaused: false,
    });
    expect(context.oscillators.length).toBeGreaterThan(0);
    const gainCount = context.gains.length;

    manager.setMusicStage('base');
    expect(context.gains).toHaveLength(gainCount);
    manager.destroy();
  });

  it('基礎期切換進階期與比賽時會更換循環並淡出舊音軌', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');
    const baseBus = context.gains[3];

    manager.setMusicStage('build');
    expect(manager.getMusicState().stageId).toBe('build');
    expect(baseBus.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.35);

    manager.setMusicStage('race');
    expect(manager.getMusicState()).toMatchObject({ stageId: 'race', isPlaying: true });
    expect(context.filters.map((filter) => filter.frequency.value)).toEqual([2_600, 3_200, 3_800]);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    manager.destroy();
  });

  it('基礎期會排程旋律、低音、低頻鼓與高頻節奏聲部', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');

    context.currentTime = 0.25;
    vi.advanceTimersByTime(50);
    context.currentTime = 0.5;
    vi.advanceTimersByTime(50);

    const scheduledFrequencies = context.oscillators.map(
      (oscillator) => oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
    );
    expect(scheduledFrequencies).toContain(261.63);
    expect(scheduledFrequencies).toContain(130.81);
    expect(scheduledFrequencies).toContain(196);
    expect(scheduledFrequencies).toContain(112);
    expect(scheduledFrequencies).toContain(920);
    manager.destroy();
  });

  it.each([
    ['base', 130, 2],
    ['build', 150, 1],
    ['race', 170, 1],
  ] as const)('%s 關卡的實際八分音符排程符合 %i BPM', async (stageId, bpm, firstEventGapSteps) => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage(stageId);

    context.currentTime = 0.35;
    vi.advanceTimersByTime(50);
    const scheduledStartTimes = [
      ...new Set(
        context.oscillators
          .map((oscillator) => oscillator.start.mock.calls[0]?.[0] as number | undefined)
          .filter((startTime): startTime is number => startTime !== undefined),
      ),
    ].sort((left, right) => left - right);

    expect(scheduledStartTimes.length).toBeGreaterThanOrEqual(2);
    expect((scheduledStartTimes[1] ?? 0) - (scheduledStartTimes[0] ?? 0)).toBeCloseTo(
      (60 / bpm / 2) * firstEventGapSteps,
      8,
    );
    manager.destroy();
  });

  it('暫停與靜音會停止排程，恢復時回到目前關卡', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('race');
    manager.playFinish();
    const effectOscillators = context.oscillators.slice(-4);

    manager.setMusicPaused(true);
    expect(manager.getMusicState()).toEqual({
      stageId: 'race',
      isPlaying: false,
      isPaused: true,
    });
    for (const oscillator of effectOscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(2);
      expect(oscillator.disconnect).toHaveBeenCalledOnce();
    }

    manager.setMusicPaused(false);
    expect(manager.getMusicState()).toEqual({
      stageId: 'race',
      isPlaying: true,
      isPaused: false,
    });

    manager.setEnabled(false);
    expect(manager.getMusicState()).toMatchObject({ stageId: 'race', isPlaying: false });
    manager.setEnabled(true);
    expect(manager.getMusicState()).toMatchObject({ stageId: 'race', isPlaying: true });

    manager.stopMusic();
    expect(manager.getMusicState()).toEqual({
      stageId: null,
      isPlaying: false,
      isPaused: false,
    });
    manager.destroy();
  });

  it('切關提示音會壓低配樂後復原，且不使用額外延遲計時器', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');
    const timerCountBeforeTransition = vi.getTimerCount();
    const oscillatorCountBeforeTransition = context.oscillators.length;

    manager.setMusicStage('build');

    const musicGain = context.gains[1];
    const duckTargets = musicGain.gain.exponentialRampToValueAtTime.mock.calls.map(
      ([value]) => value,
    );
    expect(duckTargets).toContain(0.56);
    expect(duckTargets.at(-1)).toBe(0.82);
    expect(musicGain.gain.cancelAndHoldAtTime).toHaveBeenCalled();
    expect(context.oscillators.length - oscillatorCountBeforeTransition).toBeGreaterThanOrEqual(3);
    // The old interval is replaced by the new interval; only its fade cleanup is added.
    expect(vi.getTimerCount()).toBe(timerCountBeforeTransition + 1);
    manager.destroy();
  });

  it('舊瀏覽器缺少 cancelAndHoldAtTime 時會保留目前音量再取消排程', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');
    const baseBus = context.gains[3];
    Reflect.deleteProperty(baseBus.gain, 'cancelAndHoldAtTime');
    baseBus.gain.value = 0.42;

    manager.setMusicStage('build');

    expect(baseBus.gain.cancelScheduledValues).toHaveBeenCalled();
    expect(baseBus.gain.setValueAtTime).toHaveBeenCalledWith(0.42, 0);
    manager.destroy();
  });

  it('cancelAndHoldAtTime 被瀏覽器拒絕時會安全改用相容流程', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('base');
    const musicGain = context.gains[1];
    musicGain.gain.value = 0.7;
    musicGain.gain.cancelAndHoldAtTime.mockImplementationOnce(() => {
      throw new Error('unsupported');
    });

    manager.playHit();

    expect(musicGain.gain.cancelScheduledValues).toHaveBeenCalled();
    expect(musicGain.gain.setValueAtTime).toHaveBeenCalledWith(0.7, 0);
    manager.destroy();
  });

  it('音樂與提示音分流並經過壓縮器，提示音使用無爆音的淡入淡出包絡', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.playPickup();

    expect(context.compressors).toHaveLength(1);
    expect(context.compressors[0]?.threshold.value).toBe(-18);
    expect(context.gains[1]?.gain.value).toBe(0.82);
    expect(context.gains[2]?.gain.value).toBe(0.88);

    const effectGains = context.gains.slice(-2);
    for (const gain of effectGains) {
      expect(gain.gain.setValueAtTime.mock.calls[0]?.[0]).toBe(0.0001);
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(2);
    }
    manager.destroy();
  });

  it('銷毀時會清除循環、排程提示音、處理節點與 AudioContext', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('build');
    manager.playFinish();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    manager.destroy();

    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.compressors[0]?.disconnect).toHaveBeenCalledOnce();
    expect(context.filters[0]?.disconnect).toHaveBeenCalledOnce();
    for (const oscillator of context.oscillators) {
      expect(oscillator.disconnect).toHaveBeenCalledOnce();
    }
    for (const gain of context.gains) {
      expect(gain.disconnect).toHaveBeenCalledOnce();
    }
    expect(manager.getMusicState()).toMatchObject({ stageId: null, isPlaying: false });
  });
});
