import { MUSIC_ENGINE_CONFIG, STAGE_MUSIC_CONFIG } from '../config';
import type { MarathonStageId } from '../types';

interface SoundManagerOptions {
  readonly createAudioContext?: () => AudioContext;
}

interface MusicSession {
  readonly stageId: MarathonStageId;
  readonly bus: GainNode;
  readonly filter: BiquadFilterNode;
  readonly voices: Set<ActiveVoice>;
  nextStepTime: number;
  stepIndex: number;
  timerId?: number;
  retired: boolean;
}

interface ActiveVoice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  readonly session?: MusicSession;
  disposed: boolean;
}

export interface MusicPlaybackState {
  readonly stageId: MarathonStageId | null;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
}

/** Runtime-generated sound effects and original procedural stage music. */
export class SoundManager {
  private readonly createAudioContext: () => AudioContext;
  private context?: AudioContext;
  private masterGain?: GainNode;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private enabled = true;
  private destroyed = false;
  private musicPaused = false;
  private desiredMusicStage?: MarathonStageId;
  private activeMusicSession?: MusicSession;
  private readonly musicSessions = new Set<MusicSession>();
  private readonly activeVoices = new Set<ActiveVoice>();
  private readonly activeEffectVoices = new Set<ActiveVoice>();
  private readonly cleanupTimers = new Set<number>();

  public constructor(options: SoundManagerOptions = {}) {
    this.createAudioContext = options.createAudioContext ?? (() => this.createDefaultContext());
  }

  public setEnabled(enabled: boolean): void {
    if (this.destroyed || this.enabled === enabled) return;

    this.enabled = enabled;
    if (!enabled) {
      this.fadeMasterGain(0.0001, MUSIC_ENGINE_CONFIG.pauseFadeSeconds);
      this.retireActiveMusic(MUSIC_ENGINE_CONFIG.pauseFadeSeconds);
      this.stopEffectVoices();
      return;
    }

    void this.unlock().catch(() => undefined);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async unlock(): Promise<void> {
    if (!this.enabled || this.destroyed) return;

    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;

    this.fadeMasterGain(1, 0.04);
    this.restoreMusicGain();
    this.startDesiredMusic();
  }

  public setMusicStage(stageId: MarathonStageId): void {
    if (this.destroyed) return;

    const previousStageId = this.activeMusicSession?.stageId;
    this.desiredMusicStage = stageId;
    if (!this.enabled || this.musicPaused) return;
    if (this.activeMusicSession?.stageId === stageId) return;
    this.startDesiredMusic();
    if (previousStageId && previousStageId !== stageId && this.activeMusicSession) {
      this.playStageTransitionStinger(stageId);
    }
  }

  public setMusicPaused(paused: boolean): void {
    if (this.destroyed || this.musicPaused === paused) return;

    this.musicPaused = paused;
    if (paused) {
      this.retireActiveMusic(MUSIC_ENGINE_CONFIG.pauseFadeSeconds);
      this.stopEffectVoices();
      return;
    }

    if (this.enabled) {
      void this.unlock().catch(() => undefined);
    }
  }

  public stopMusic(): void {
    this.desiredMusicStage = undefined;
    this.musicPaused = false;
    this.retireActiveMusic(MUSIC_ENGINE_CONFIG.pauseFadeSeconds);
  }

  public getMusicState(): MusicPlaybackState {
    return {
      stageId: this.desiredMusicStage ?? null,
      isPlaying: Boolean(this.activeMusicSession && !this.activeMusicSession.retired),
      isPaused: this.musicPaused,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.desiredMusicStage = undefined;

    for (const timerId of this.cleanupTimers) window.clearTimeout(timerId);
    this.cleanupTimers.clear();

    for (const session of [...this.musicSessions]) this.disposeMusicSession(session);
    for (const voice of [...this.activeVoices]) this.disposeVoice(voice, true);

    this.musicGain?.disconnect();
    this.effectsGain?.disconnect();
    this.masterGain?.disconnect();
    this.compressor?.disconnect();
    this.musicGain = undefined;
    this.effectsGain = undefined;
    this.masterGain = undefined;
    this.compressor = undefined;

    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }

  public playJump(): void {
    this.effectTone(290, 0.065, 'sine', 0.026, 470);
    this.effectTone(680, 0.055, 'triangle', 0.011, 520, 0.014);
  }

  public playPickup(): void {
    this.effectTone(784, 0.09, 'sine', 0.026, 1_046.5);
    this.effectTone(1_046.5, 0.11, 'triangle', 0.019, 1_318.5, 0.055);
  }

  public playHit(): void {
    this.duckMusic(0.22);
    this.effectTone(155, 0.14, 'sine', 0.035, 72);
    this.effectTone(330, 0.11, 'triangle', 0.014, 132, 0.012);
  }

  public playGameOver(): void {
    this.duckMusic(0.44);
    this.effectTone(329.63, 0.18, 'triangle', 0.027, 246.94);
    this.effectTone(220, 0.28, 'sine', 0.026, 130.81, 0.13);
  }

  public playFinish(): void {
    this.duckMusic(0.52);
    this.effectTone(392, 0.2, 'triangle', 0.024, 523.25);
    this.effectTone(493.88, 0.22, 'triangle', 0.022, 659.25, 0.075);
    this.effectTone(587.33, 0.26, 'sine', 0.024, 783.99, 0.15);
    this.effectTone(783.99, 0.34, 'triangle', 0.018, 1_046.5, 0.24);
  }

  private createDefaultContext(): AudioContext {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('Web Audio API is unavailable.');
    return new AudioContextConstructor();
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;

    const context = this.createAudioContext();
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const effectsGain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const now = context.currentTime;

    masterGain.gain.setValueAtTime(this.enabled ? 1 : 0.0001, context.currentTime);
    musicGain.gain.setValueAtTime(MUSIC_ENGINE_CONFIG.musicBusVolume, now);
    effectsGain.gain.setValueAtTime(MUSIC_ENGINE_CONFIG.effectsBusVolume, now);
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(14, now);
    compressor.ratio.setValueAtTime(4, now);
    compressor.attack.setValueAtTime(0.006, now);
    compressor.release.setValueAtTime(0.18, now);

    musicGain.connect(masterGain);
    effectsGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.effectsGain = effectsGain;
    this.compressor = compressor;
    return context;
  }

  private fadeMasterGain(target: number, durationSeconds: number): void {
    const context = this.context;
    const masterGain = this.masterGain;
    if (!context || !masterGain) return;

    const now = context.currentTime;
    this.holdAudioParam(masterGain.gain, now);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + durationSeconds);
  }

  /** Preserve the audible value before replacing an active automation curve. */
  private holdAudioParam(param: AudioParam, time: number): void {
    const fallbackValue = Math.max(0.0001, param.value);
    if (typeof param.cancelAndHoldAtTime === 'function') {
      try {
        param.cancelAndHoldAtTime(time);
        return;
      } catch {
        // Older WebKit implementations may expose the method but reject it.
      }
    }

    param.cancelScheduledValues(time);
    param.setValueAtTime(fallbackValue, time);
  }

  private startDesiredMusic(): void {
    const stageId = this.desiredMusicStage;
    const context = this.context;
    if (
      !stageId ||
      !context ||
      context.state !== 'running' ||
      !this.enabled ||
      this.musicPaused ||
      this.destroyed
    ) {
      return;
    }
    if (this.activeMusicSession?.stageId === stageId) return;

    const previousSession = this.activeMusicSession;
    const track = STAGE_MUSIC_CONFIG[stageId];
    const bus = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime;
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(1, now + MUSIC_ENGINE_CONFIG.crossfadeSeconds);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(track.filterCutoffHz, now);
    filter.Q.setValueAtTime(0.55, now);
    bus.connect(filter);
    filter.connect(this.musicGain ?? this.masterGain ?? context.destination);

    const session: MusicSession = {
      stageId,
      bus,
      filter,
      voices: new Set(),
      nextStepTime: now + 0.03,
      stepIndex: 0,
      retired: false,
    };
    this.musicSessions.add(session);
    this.activeMusicSession = session;

    this.scheduleMusic(session);
    session.timerId = window.setInterval(
      () => this.scheduleMusic(session),
      MUSIC_ENGINE_CONFIG.schedulerIntervalMs,
    );

    if (previousSession) {
      this.retireMusicSession(previousSession, MUSIC_ENGINE_CONFIG.crossfadeSeconds);
    }
  }

  private scheduleMusic(session: MusicSession): void {
    const context = this.context;
    if (
      !context ||
      context.state !== 'running' ||
      session !== this.activeMusicSession ||
      session.retired ||
      !this.enabled ||
      this.musicPaused
    ) {
      return;
    }

    const track = STAGE_MUSIC_CONFIG[session.stageId];
    const stepSeconds = 60 / track.bpm / MUSIC_ENGINE_CONFIG.stepsPerBeat;
    if (session.nextStepTime < context.currentTime - stepSeconds) {
      session.nextStepTime = context.currentTime + 0.03;
    }

    const scheduleUntil = context.currentTime + MUSIC_ENGINE_CONFIG.scheduleAheadSeconds;
    while (session.nextStepTime < scheduleUntil) {
      const stepIndex = session.stepIndex;
      const melodyFrequency = track.melodyHz[stepIndex];
      const bassFrequency = track.bassHz[stepIndex];
      const harmonyFrequency = track.harmonyHz[stepIndex];
      const dynamics = track.dynamics[stepIndex] ?? 1;

      if (melodyFrequency !== null) {
        this.scheduleVoice(
          session,
          melodyFrequency,
          session.nextStepTime,
          stepSeconds * track.melodyDurationSteps,
          track.melodyWave,
          track.melodyVolume * dynamics,
        );
      }
      if (bassFrequency !== null) {
        this.scheduleVoice(
          session,
          bassFrequency,
          session.nextStepTime,
          stepSeconds * track.bassDurationSteps,
          track.bassWave,
          track.bassVolume * dynamics,
          bassFrequency,
          0.018,
        );
      }
      if (harmonyFrequency !== null) {
        this.scheduleVoice(
          session,
          harmonyFrequency,
          session.nextStepTime,
          stepSeconds * track.harmonyDurationSteps,
          track.harmonyWave,
          track.harmonyVolume * dynamics,
          harmonyFrequency,
          0.032,
        );
      }
      if (track.kick.pattern[stepIndex]) {
        this.scheduleVoice(
          session,
          track.kick.startFrequencyHz,
          session.nextStepTime,
          track.kick.durationSeconds,
          track.kick.wave,
          track.kick.volume * dynamics,
          track.kick.endFrequencyHz,
          0.004,
        );
      }
      if (track.accent.pattern[stepIndex]) {
        this.scheduleVoice(
          session,
          track.accent.startFrequencyHz,
          session.nextStepTime,
          track.accent.durationSeconds,
          track.accent.wave,
          track.accent.volume * dynamics,
          track.accent.endFrequencyHz,
          0.003,
        );
      }

      session.stepIndex = (stepIndex + 1) % track.melodyHz.length;
      session.nextStepTime += stepSeconds;
    }
  }

  private scheduleVoice(
    session: MusicSession,
    startFrequency: number,
    startTime: number,
    durationSeconds: number,
    wave: OscillatorType,
    volume: number,
    endFrequency = startFrequency,
    attackSeconds = 0.012,
  ): void {
    const context = this.context;
    if (!context || session.retired) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endTime = startTime + durationSeconds;
    const attackEndTime = Math.min(
      endTime,
      startTime + Math.min(attackSeconds, durationSeconds * 0.24),
    );

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    if (endFrequency !== startFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), attackEndTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(session.bus);
    const voice: ActiveVoice = {
      oscillator,
      gain,
      session,
      disposed: false,
    };
    session.voices.add(voice);
    this.activeVoices.add(voice);
    oscillator.addEventListener('ended', () => this.disposeVoice(voice, false), { once: true });
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }

  private retireActiveMusic(fadeSeconds: number): void {
    if (this.activeMusicSession) {
      this.retireMusicSession(this.activeMusicSession, fadeSeconds);
    }
  }

  private retireMusicSession(session: MusicSession, fadeSeconds: number): void {
    if (session.retired) return;
    session.retired = true;
    if (session.timerId !== undefined) window.clearInterval(session.timerId);
    session.timerId = undefined;
    if (this.activeMusicSession === session) this.activeMusicSession = undefined;

    const context = this.context;
    if (!context || fadeSeconds <= 0) {
      this.disposeMusicSession(session);
      return;
    }

    const now = context.currentTime;
    this.holdAudioParam(session.bus.gain, now);
    session.bus.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    this.scheduleCleanup(() => this.disposeMusicSession(session), fadeSeconds * 1_000 + 40);
  }

  private disposeMusicSession(session: MusicSession): void {
    if (session.timerId !== undefined) window.clearInterval(session.timerId);
    session.timerId = undefined;

    for (const voice of [...session.voices]) {
      this.disposeVoice(voice, true);
    }
    session.bus.disconnect();
    session.filter.disconnect();
    this.musicSessions.delete(session);
    if (this.activeMusicSession === session) this.activeMusicSession = undefined;
  }

  private effectTone(
    startFrequency: number,
    durationSeconds: number,
    wave: OscillatorType,
    volume: number,
    endFrequency: number,
    delaySeconds = 0,
  ): void {
    if (!this.enabled || this.destroyed) return;

    let context: AudioContext;
    try {
      context = this.ensureContext();
    } catch {
      return;
    }
    if (context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = context.currentTime + delaySeconds;
    const endTime = startTime + durationSeconds;
    const attackEndTime = Math.min(endTime, startTime + Math.min(0.008, durationSeconds * 0.2));

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), attackEndTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(this.effectsGain ?? this.masterGain ?? context.destination);
    const voice: ActiveVoice = {
      oscillator,
      gain,
      disposed: false,
    };
    this.activeVoices.add(voice);
    this.activeEffectVoices.add(voice);
    oscillator.addEventListener('ended', () => this.disposeVoice(voice, false), { once: true });
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }

  private playStageTransitionStinger(stageId: MarathonStageId): void {
    this.duckMusic(0.42);

    if (stageId === 'build') {
      this.effectTone(293.66, 0.16, 'triangle', 0.021, 369.99);
      this.effectTone(440, 0.18, 'sine', 0.02, 587.33, 0.085);
      this.effectTone(587.33, 0.24, 'triangle', 0.018, 739.99, 0.17);
      return;
    }

    if (stageId === 'race') {
      this.effectTone(329.63, 0.14, 'triangle', 0.021, 440);
      this.effectTone(493.88, 0.16, 'triangle', 0.021, 659.25, 0.065);
      this.effectTone(659.25, 0.2, 'sine', 0.022, 880, 0.13);
      this.effectTone(880, 0.28, 'triangle', 0.017, 1_174.66, 0.205);
    }
  }

  private duckMusic(holdSeconds: number): void {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain || !this.enabled || this.musicPaused) return;

    const now = context.currentTime;
    const attackEnd = now + MUSIC_ENGINE_CONFIG.duckAttackSeconds;
    this.holdAudioParam(musicGain.gain, now);
    musicGain.gain.exponentialRampToValueAtTime(MUSIC_ENGINE_CONFIG.duckVolume, attackEnd);
    musicGain.gain.setValueAtTime(MUSIC_ENGINE_CONFIG.duckVolume, attackEnd + holdSeconds);
    musicGain.gain.exponentialRampToValueAtTime(
      MUSIC_ENGINE_CONFIG.musicBusVolume,
      attackEnd + holdSeconds + MUSIC_ENGINE_CONFIG.duckReleaseSeconds,
    );
  }

  private restoreMusicGain(): void {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain) return;

    const now = context.currentTime;
    this.holdAudioParam(musicGain.gain, now);
    musicGain.gain.setValueAtTime(MUSIC_ENGINE_CONFIG.musicBusVolume, now);
  }

  private stopEffectVoices(): void {
    for (const voice of [...this.activeEffectVoices]) this.disposeVoice(voice, true);
  }

  private disposeVoice(voice: ActiveVoice, shouldStop: boolean): void {
    if (voice.disposed) return;
    voice.disposed = true;
    voice.session?.voices.delete(voice);
    this.activeVoices.delete(voice);
    this.activeEffectVoices.delete(voice);

    if (shouldStop) {
      try {
        voice.oscillator.stop();
      } catch {
        // The oscillator may already have ended; disconnecting is still safe.
      }
    }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }

  private scheduleCleanup(callback: () => void, delayMs: number): void {
    if (this.destroyed) return;
    const timerId = window.setTimeout(() => {
      this.cleanupTimers.delete(timerId);
      if (!this.destroyed) callback();
    }, delayMs);
    this.cleanupTimers.add(timerId);
  }
}
