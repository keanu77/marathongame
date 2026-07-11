import Phaser from 'phaser';

export const GAME_EVENTS = {
  sceneReady: 'scene-ready',
  hudUpdated: 'hud-updated',
  feedback: 'feedback',
  runStarted: 'run-started',
  stageTransitionChanged: 'stage-transition-changed',
  musicStageChanged: 'music-stage-changed',
  pauseChanged: 'pause-changed',
  gameOver: 'game-over',
  sound: 'sound',
} as const;

export type SoundCue = 'jump' | 'pickup' | 'hit' | 'gameOver' | 'finish';

export interface GameFeedback {
  readonly text: string;
  readonly tone: 'positive' | 'danger';
  readonly durationMs: number;
}

export const gameEventBus = new Phaser.Events.EventEmitter();
