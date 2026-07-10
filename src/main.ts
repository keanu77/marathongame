import './styles.css';

import { GAME_CONFIG } from './game/config';
import {
  GAME_OVER_REASON_LABELS,
  MARATHON_STAGE_LABELS,
  OBSTACLE_LABELS,
  PACE_MODE_LABELS,
} from './game/data';
import { createGame } from './game/createGame';
import { GAME_EVENTS, gameEventBus, type SoundCue } from './game/events/GameEventBus';
import { GameScene } from './game/scenes/GameScene';
import { addLeaderboardEntry, readLeaderboard } from './game/systems';
import type { GameOverResult, HudSnapshot, MarathonStageId, PaceMode } from './game/types';
import { SoundManager, type MusicPlaybackState } from './game/utils/SoundManager';
import { GameUI, type HUDStatus } from './ui/GameUI';
import type { LeaderboardRow, MarathonStageNumber, PaceTone } from './ui/types';

declare global {
  interface Window {
    __GAME_TEST__?: {
      endGame: (reason?: 'energy' | 'injuryRisk') => void;
      completeGame: () => void;
      getPlayerState: () => string;
      setStage: (stageId: MarathonStageId) => void;
      getMusicState: () => MusicPlaybackState;
    };
  }
}

const soundManager = new SoundManager();
let sceneReady = false;
let latestResult: GameOverResult | null = null;
let currentLeaderboardEntryId: string | undefined;

const getScene = (): GameScene | null => {
  const scene = game.scene.getScene(GameScene.KEY);
  return scene instanceof GameScene ? scene : null;
};

const ui = new GameUI({
  root: '#app',
  initialSoundEnabled: true,
  callbacks: {
    onStart: () => {
      void soundManager.unlock().catch(() => undefined);
      latestResult = null;
      currentLeaderboardEntryId = undefined;
      const scene = getScene();
      if (scene) scene.startRun();
      else ui.showHome();
    },
    onJump: () => getScene()?.requestJump(),
    onPause: () => getScene()?.togglePause(true),
    onResume: () => {
      void soundManager.unlock().catch(() => undefined);
      getScene()?.togglePause(false);
    },
    onRestart: () => {
      void soundManager.unlock().catch(() => undefined);
      latestResult = null;
      currentLeaderboardEntryId = undefined;
      getScene()?.startRun();
    },
    onHome: () => {
      soundManager.stopMusic();
      getScene()?.returnHome();
    },
    onSoundChange: (enabled) => {
      soundManager.setEnabled(enabled);
      getScene()?.setSoundEnabled(enabled);
    },
    onLeaderboardOpen: () => renderLeaderboard(),
    onScoreSubmit: (name) => saveLatestResult(name),
    onShare: () => undefined,
  },
});

ui.setStartEnabled(false);
gameEventBus.on(GAME_EVENTS.sceneReady, () => {
  sceneReady = true;
  ui.setStartEnabled(true);
});

const game = createGame('game-container');

gameEventBus.on(GAME_EVENTS.runStarted, () => {
  ui.resetHUD({
    speed: GAME_CONFIG.initialSpeed,
    energy: GAME_CONFIG.initialEnergy,
    maxEnergy: GAME_CONFIG.maxEnergy,
    injuryRisk: GAME_CONFIG.initialInjuryRisk,
    maxInjuryRisk: GAME_CONFIG.maxInjuryRisk,
    stageNumber: 1,
    totalStages: 3,
    stageName: MARATHON_STAGE_LABELS.base,
    overallProgressPercent: 0,
    paceLabel: '建立輕鬆節奏',
    paceTone: 'comfortable',
  });
  ui.showPlaying();
});

gameEventBus.on(GAME_EVENTS.pauseChanged, (paused: boolean) => {
  soundManager.setMusicPaused(paused);
  ui.setPaused(paused);
});

gameEventBus.on(GAME_EVENTS.musicStageChanged, (stageId: MarathonStageId) => {
  soundManager.setMusicStage(stageId);
});

gameEventBus.on(GAME_EVENTS.hudUpdated, (snapshot: HudSnapshot) => {
  const pace = getPacePresentation(snapshot);
  ui.updateHUD({
    distanceMeters: snapshot.distanceMeters,
    score: snapshot.score,
    energy: snapshot.energy,
    maxEnergy: GAME_CONFIG.maxEnergy,
    injuryRisk: snapshot.injuryRisk,
    maxInjuryRisk: GAME_CONFIG.maxInjuryRisk,
    speed: snapshot.speed,
    difficultyLevel: snapshot.difficultyLevel,
    difficultyLabel: getDifficultyLabel(snapshot.stageId),
    stageNumber: toStageNumber(snapshot.stageIndex),
    totalStages: 3,
    stageName: MARATHON_STAGE_LABELS[snapshot.stageId],
    overallProgressPercent: Math.round(snapshot.overallProgress * 100),
    paceLabel: pace.label,
    paceTone: pace.tone,
    statuses: createHudStatuses(snapshot),
  });
});

gameEventBus.on(GAME_EVENTS.gameOver, (result: GameOverResult) => {
  soundManager.stopMusic();
  latestResult = result;
  currentLeaderboardEntryId = undefined;
  const completed = result.outcome === 'completed';
  const obstacleLabel = result.dominantObstacle ? OBSTACLE_LABELS[result.dominantObstacle] : null;
  const conditionLabel = result.reason ? GAME_OVER_REASON_LABELS[result.reason] : null;
  const resultDescription = completed
    ? '完成基礎期、進階期與正式比賽'
    : obstacleLabel
      ? `${obstacleLabel}（${conditionLabel ?? '中途停止'}）`
      : (conditionLabel ?? '中途停止');

  ui.showGameOver({
    distanceMeters: result.distanceMeters,
    score: result.score,
    highScore: result.highScore,
    failureReason: resultDescription,
    educationMessage: result.educationMessage,
    educationAction: result.educationAction,
    isNewHighScore: result.isNewHighScore,
    outcome: result.outcome,
    stageNumber: toStageNumber(result.stageIndex),
    totalStages: 3,
    stageName: MARATHON_STAGE_LABELS[result.stageId],
  });
});

gameEventBus.on(GAME_EVENTS.sound, (cue: SoundCue) => {
  switch (cue) {
    case 'jump':
      soundManager.playJump();
      break;
    case 'pickup':
      soundManager.playPickup();
      break;
    case 'hit':
      soundManager.playHit();
      break;
    case 'gameOver':
      soundManager.playGameOver();
      break;
    case 'finish':
      soundManager.playFinish();
      break;
  }
});

const handleVisibilityChange = (): void => {
  const scene = sceneReady ? getScene() : null;
  if (document.hidden && scene?.getRunState() === 'running') {
    scene.togglePause(true);
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);

if (new URLSearchParams(window.location.search).get('e2e') === '1') {
  window.__GAME_TEST__ = {
    endGame: (reason = 'energy') => getScene()?.forceGameOver(reason),
    completeGame: () => getScene()?.forceComplete(),
    getPlayerState: () => getScene()?.getPlayerState() ?? 'unavailable',
    setStage: (stageId) => getScene()?.forceStage(stageId),
    getMusicState: () => soundManager.getMusicState(),
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    gameEventBus.removeAllListeners();
    soundManager.destroy();
    game.destroy(true);
    ui.destroy();
    delete window.__GAME_TEST__;
  });
}

function toStageNumber(stageIndex: number): MarathonStageNumber {
  if (stageIndex >= 2) return 3;
  if (stageIndex >= 1) return 2;
  return 1;
}

function getDifficultyLabel(stageId: MarathonStageId): string {
  switch (stageId) {
    case 'base':
      return '建立基礎';
    case 'build':
      return '訓練進階';
    case 'race':
      return '正式賽程';
  }
}

function getPacePresentation(snapshot: HudSnapshot): { label: string; tone: PaceTone } {
  const hasRecoveryDeficit = snapshot.statusEffects.recoveryDeficitRemainingSeconds > 0;
  let label: string;
  let tone: PaceTone;

  switch (snapshot.paceMode) {
    case 'zone2':
      label = 'Zone 2：穩定省能';
      tone = 'comfortable';
      break;
    case 'lsd':
      label = 'LSD：耐力省能';
      tone = 'steady';
      break;
    case 'interval':
      label = '間歇：快速、較耗能';
      tone = 'challenging';
      break;
    default:
      label = getDefaultPaceLabel(snapshot.stageId);
      tone = snapshot.stageId === 'base' ? 'comfortable' : 'steady';
  }

  return hasRecoveryDeficit ? { label: `${label}・恢復不足`, tone: 'warning' } : { label, tone };
}

function getDefaultPaceLabel(stageId: MarathonStageId): string {
  switch (stageId) {
    case 'base':
      return '建立輕鬆節奏';
    case 'build':
      return '穩定訓練節奏';
    case 'race':
      return '穩住比賽配速';
  }
}

function createHudStatuses(snapshot: HudSnapshot): HUDStatus[] {
  const statuses: HUDStatus[] = [];
  const effects = snapshot.statusEffects;

  if (effects.recoveryDeficitRemainingSeconds > 0) {
    statuses.push({
      id: 'recovery-deficit',
      icon: '🌡️',
      label: '恢復不足／耗能增加',
      remainingSeconds: effects.recoveryDeficitRemainingSeconds,
      tone: 'warning',
    });
  }
  if (effects.strengthProtectionRemainingSeconds > 0) {
    statuses.push({
      id: 'strength-protection',
      icon: '🛡️',
      label: '阻力訓練防護',
      remainingSeconds: effects.strengthProtectionRemainingSeconds,
      tone: 'positive',
    });
  }
  if (effects.paceMode !== null && effects.paceRemainingSeconds > 0) {
    statuses.push(createPaceStatus(effects.paceMode, effects.paceRemainingSeconds));
  }

  return statuses;
}

function createPaceStatus(mode: PaceMode, remainingSeconds: number): HUDStatus {
  const icons: Record<PaceMode, string> = {
    zone2: '💚',
    lsd: '🛣️',
    interval: '⚡',
  };
  return {
    id: `pace-${mode}`,
    icon: icons[mode],
    label: PACE_MODE_LABELS[mode],
    remainingSeconds,
    tone: mode === 'interval' ? 'warning' : 'positive',
  };
}

function saveLatestResult(name: string): void {
  if (latestResult === null) {
    ui.setScoreSaveError('目前沒有可儲存的成績。');
    return;
  }

  const result = addLeaderboardEntry({
    name,
    score: latestResult.score,
    distanceMeters: latestResult.distanceMeters,
    outcome: latestResult.outcome,
    stageId: latestResult.stageId,
  });

  if (!result.persisted) {
    ui.setScoreSaveError('瀏覽器目前無法儲存成績，請檢查網站儲存權限後再試。');
    return;
  }

  currentLeaderboardEntryId = result.rank === null ? undefined : result.entry.id;
  ui.setScoreSaved(result.rank, result.entry.name);
  ui.setSharePlayerName(result.entry.name);
}

function renderLeaderboard(): void {
  const rows: LeaderboardRow[] = readLeaderboard().map((entry) => ({
    id: entry.id,
    name: entry.name,
    score: entry.score,
    distanceMeters: entry.distanceMeters,
    outcome: entry.outcome,
  }));
  ui.showLeaderboard(rows, currentLeaderboardEntryId);
}
