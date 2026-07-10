import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundManager } from './SoundManager';

class FakeAudioParam {
  public value = 1;
  public readonly cancelScheduledValues = vi.fn();
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
    const baseBus = context.gains[1];

    manager.setMusicStage('build');
    expect(manager.getMusicState().stageId).toBe('build');
    expect(baseBus.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.35);

    manager.setMusicStage('race');
    expect(manager.getMusicState()).toMatchObject({ stageId: 'race', isPlaying: true });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    manager.destroy();
  });

  it('暫停與靜音會停止排程，恢復時回到目前關卡', async () => {
    const { manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('race');

    manager.setMusicPaused(true);
    expect(manager.getMusicState()).toEqual({
      stageId: 'race',
      isPlaying: false,
      isPaused: true,
    });

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

  it('銷毀時會清除循環、延遲提示音與 AudioContext', async () => {
    const { context, manager } = createManager();
    await manager.unlock();
    manager.setMusicStage('build');
    manager.playFinish();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    manager.destroy();

    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledOnce();
    expect(manager.getMusicState()).toMatchObject({ stageId: null, isPlaying: false });
  });
});
