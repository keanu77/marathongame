import Phaser from 'phaser';

export const GAME_EVENTS = {
  sceneReady: 'scene-ready',
  hudUpdated: 'hud-updated',
  runStarted: 'run-started',
  musicStageChanged: 'music-stage-changed',
  pauseChanged: 'pause-changed',
  gameOver: 'game-over',
  sound: 'sound',
} as const;

export type SoundCue = 'jump' | 'pickup' | 'hit' | 'gameOver' | 'finish';

export const gameEventBus = new Phaser.Events.EventEmitter();
