import { MUSIC_ENGINE_CONFIG, STAGE_MUSIC_CONFIG } from '../config';
import type { MarathonStageId } from '../types';

interface SoundManagerOptions {
  readonly createAudioContext?: () => AudioContext;
}

interface MusicSession {
  readonly stageId: MarathonStageId;
  readonly bus: GainNode;
  readonly sources: Set<OscillatorNode>;
  nextStepTime: number;
  stepIndex: number;
  timerId?: number;
  retired: boolean;
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
  private enabled = true;
  private destroyed = false;
  private musicPaused = false;
  private desiredMusicStage?: MarathonStageId;
  private activeMusicSession?: MusicSession;
  private readonly musicSessions = new Set<MusicSession>();
  private readonly activeSources = new Set<OscillatorNode>();
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
    this.startDesiredMusic();
  }

  public setMusicStage(stageId: MarathonStageId): void {
    if (this.destroyed) return;

    this.desiredMusicStage = stageId;
    if (!this.enabled || this.musicPaused) return;
    if (this.activeMusicSession?.stageId === stageId) return;
    this.startDesiredMusic();
  }

  public setMusicPaused(paused: boolean): void {
    if (this.destroyed || this.musicPaused === paused) return;

    this.musicPaused = paused;
    if (paused) {
      this.retireActiveMusic(MUSIC_ENGINE_CONFIG.pauseFadeSeconds);
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
    for (const source of [...this.activeSources]) this.stopAndDisconnectSource(source);

    this.masterGain?.disconnect();
    this.masterGain = undefined;

    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }

  public playJump(): void {
    this.tone(420, 0.07, 'sine', 0.045, 630);
  }

  public playPickup(): void {
    this.tone(660, 0.08, 'sine', 0.05, 880);
  }

  public playHit(): void {
    this.tone(135, 0.12, 'square', 0.035, 85);
  }

  public playGameOver(): void {
    this.tone(260, 0.22, 'triangle', 0.045, 120);
  }

  public playFinish(): void {
    this.tone(520, 0.16, 'triangle', 0.05, 880);
    this.scheduleCleanup(() => this.tone(660, 0.22, 'triangle', 0.045, 1_040), 120);
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
    masterGain.gain.setValueAtTime(this.enabled ? 1 : 0.0001, context.currentTime);
    masterGain.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private fadeMasterGain(target: number, durationSeconds: number): void {
    const context = this.context;
    const masterGain = this.masterGain;
    if (!context || !masterGain) return;

    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + durationSeconds);
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
    const bus = context.createGain();
    const now = context.currentTime;
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(1, now + MUSIC_ENGINE_CONFIG.crossfadeSeconds);
    bus.connect(this.masterGain ?? context.destination);

    const session: MusicSession = {
      stageId,
      bus,
      sources: new Set(),
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

      if (melodyFrequency !== null) {
        this.scheduleVoice(
          session,
          melodyFrequency,
          session.nextStepTime,
          stepSeconds * track.melodyDurationSteps,
          track.melodyWave,
          track.melodyVolume,
        );
      }
      if (bassFrequency !== null) {
        this.scheduleVoice(
          session,
          bassFrequency,
          session.nextStepTime,
          stepSeconds * track.bassDurationSteps,
          track.bassWave,
          track.bassVolume,
        );
      }
      if (track.beatPattern[stepIndex]) {
        this.scheduleVoice(
          session,
          MUSIC_ENGINE_CONFIG.beatStartFrequencyHz,
          session.nextStepTime,
          MUSIC_ENGINE_CONFIG.beatDurationSeconds,
          'sine',
          track.beatVolume,
          MUSIC_ENGINE_CONFIG.beatEndFrequencyHz,
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
  ): void {
    const context = this.context;
    if (!context || session.retired) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endTime = startTime + durationSeconds;
    const attackEndTime = Math.min(endTime, startTime + Math.min(0.018, durationSeconds * 0.24));

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
    session.sources.add(oscillator);
    this.activeSources.add(oscillator);
    oscillator.addEventListener(
      'ended',
      () => {
        session.sources.delete(oscillator);
        this.activeSources.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
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
    session.bus.gain.cancelScheduledValues(now);
    session.bus.gain.setValueAtTime(Math.max(0.0001, session.bus.gain.value), now);
    session.bus.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    this.scheduleCleanup(() => this.disposeMusicSession(session), fadeSeconds * 1_000 + 40);
  }

  private disposeMusicSession(session: MusicSession): void {
    if (session.timerId !== undefined) window.clearInterval(session.timerId);
    session.timerId = undefined;

    for (const source of [...session.sources]) {
      session.sources.delete(source);
      this.stopAndDisconnectSource(source);
    }
    session.bus.disconnect();
    this.musicSessions.delete(session);
    if (this.activeMusicSession === session) this.activeMusicSession = undefined;
  }

  private tone(
    startFrequency: number,
    durationSeconds: number,
    wave: OscillatorType,
    volume: number,
    endFrequency: number,
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
    const now = context.currentTime;

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + durationSeconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    oscillator.connect(gain);
    gain.connect(this.masterGain ?? context.destination);
    this.activeSources.add(oscillator);
    oscillator.addEventListener(
      'ended',
      () => {
        this.activeSources.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
  }

  private stopAndDisconnectSource(source: OscillatorNode): void {
    this.activeSources.delete(source);
    try {
      source.stop();
    } catch {
      // The source may already have ended; disconnecting is still safe.
    }
    source.disconnect();
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
