import './styles.css';

import { GAME_CONFIG, RUNNER_SPRITE_SHEET } from './game/config';
import {
  GAME_OVER_REASON_LABELS,
  MARATHON_STAGE_LABELS,
  OBSTACLE_LABELS,
  PACE_MODE_LABELS,
} from './game/data';
import { createGame } from './game/createGame';
import {
  GAME_EVENTS,
  gameEventBus,
  type GameFeedback,
  type SoundCue,
} from './game/events/GameEventBus';
import { GameScene } from './game/scenes/GameScene';
import type { GameOverResult, HudSnapshot, MarathonStageId, PaceMode } from './game/types';
import { SoundManager, type MusicPlaybackState } from './game/utils/SoundManager';
import {
  LeaderboardApiClient,
  LeaderboardApiError,
  type RunSession,
} from './services/leaderboardApi';
import {
  COMPLETION_CHECKPOINT_MIN_GAP_SECONDS,
  getTotalMarathonDurationSeconds,
  isCompletionCheckpointTimingValid,
} from './shared/networkLeaderboardRules';
import { GameUI, type HUDStatus } from './ui/GameUI';
import type { LeaderboardRow, MarathonStageNumber, PaceTone } from './ui/types';

declare global {
  interface Window {
    __GAME_TEST__?: {
      endGame: (reason?: 'energy' | 'injuryRisk') => void;
      completeGame: () => void;
      getPlayerState: () => string;
      getPlayerAnimationFrame: () => number;
      getPlayerJumpCount: () => number;
      getRunnerSheetDataUrl: () => string | null;
      getRunnerSheetFrameBounds: () => Array<{
        left: number;
        top: number;
        right: number;
        bottom: number;
      }> | null;
      getStageTransitionTextResolutions: () => number[];
      setStage: (stageId: MarathonStageId) => void;
      getMusicState: () => MusicPlaybackState;
      showFeedback: (kind: 'injury' | 'nutrition' | 'education') => void;
      setHudStatusCount: (count: 0 | 3) => void;
    };
  }
}

const soundManager = new SoundManager();
const leaderboardApi = new LeaderboardApiClient();
const CHECKPOINT_INTERVAL_SECONDS = 10;
const PERIODIC_CHECKPOINT_CUTOFF_SECONDS =
  getTotalMarathonDurationSeconds() - COMPLETION_CHECKPOINT_MIN_GAP_SECONDS;

interface ClientCheckpointSnapshot {
  elapsedSeconds: number;
  collectedRecoveryItems: number;
}

let sceneReady = false;
let latestResult: GameOverResult | null = null;
let currentLeaderboardEntryId: string | undefined;
let currentRunSession: RunSession | null = null;
let runSessionPromise: Promise<RunSession | null> | null = null;
let networkRunGeneration = 0;
let nextCheckpointSeconds = CHECKPOINT_INTERVAL_SECONDS;
let lastCheckpointElapsedSeconds = 0;
let latestCompletionCheckpointCandidate: ClientCheckpointSnapshot | null = null;
let checkpointQueue: Promise<void> = Promise.resolve();
let networkRunError: string | null = null;
let leaderboardRequestGeneration = 0;

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
      if (scene) {
        prepareNetworkRun();
        scene.startRun();
      } else {
        ui.showHome();
      }
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
      const scene = getScene();
      if (scene) {
        prepareNetworkRun();
        scene.startRun();
      }
    },
    onHome: () => {
      soundManager.stopMusic();
      abandonNetworkRun();
      getScene()?.returnHome();
    },
    onSoundChange: (enabled) => {
      soundManager.setEnabled(enabled);
      getScene()?.setSoundEnabled(enabled);
    },
    onLeaderboardOpen: () => void renderLeaderboard(),
    onScoreSubmit: (name) => void saveLatestResult(name),
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

gameEventBus.on(GAME_EVENTS.stageTransitionChanged, (active: boolean) => {
  ui.setStageTransitionActive(active);
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
  captureCompletionCheckpointCandidate(snapshot);
  queueNetworkCheckpoint(snapshot);
});

gameEventBus.on(GAME_EVENTS.feedback, (feedback: GameFeedback) => {
  ui.showFeedback(feedback.text, feedback.tone, feedback.durationMs);
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
    educationReminders: result.educationReminders,
    educationFocusTopic: result.educationFocusTopic,
    educationSafetyAlert: result.educationSafetyAlert,
    knowledgeReview: result.knowledgeReview,
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

// 測試控制介面只存在本機開發建置，正式站即使加入 ?e2e=1 也不會暴露。
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2e') === '1') {
  window.__GAME_TEST__ = {
    endGame: (reason = 'energy') => getScene()?.forceGameOver(reason),
    completeGame: () => getScene()?.forceComplete(),
    getPlayerState: () => getScene()?.getPlayerState() ?? 'unavailable',
    getPlayerAnimationFrame: () => getScene()?.getPlayerAnimationFrame() ?? -1,
    getPlayerJumpCount: () => getScene()?.getSuccessfulJumpCount() ?? 0,
    getRunnerSheetDataUrl: () => {
      const textureKey = game.textures
        .getTextureKeys()
        .find((key) => key.startsWith('marathon-runner'));
      if (!textureKey) return null;
      const source = game.textures.get(textureKey).getSourceImage() as HTMLCanvasElement;
      return typeof source.toDataURL === 'function' ? source.toDataURL('image/png') : null;
    },
    getRunnerSheetFrameBounds: () => {
      const textureKey = game.textures
        .getTextureKeys()
        .find((key) => key.startsWith('marathon-runner'));
      if (!textureKey) return null;
      const source = game.textures.get(textureKey).getSourceImage() as HTMLCanvasElement;
      const context = source.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      const { data } = context.getImageData(0, 0, source.width, source.height);

      return Array.from({ length: RUNNER_SPRITE_SHEET.frameCount }, (_, frameIndex) => {
        const frameX = (frameIndex % RUNNER_SPRITE_SHEET.columns) * RUNNER_SPRITE_SHEET.frameWidth;
        const frameY =
          Math.floor(frameIndex / RUNNER_SPRITE_SHEET.columns) * RUNNER_SPRITE_SHEET.frameHeight;
        let left: number = RUNNER_SPRITE_SHEET.frameWidth;
        let top: number = RUNNER_SPRITE_SHEET.frameHeight;
        let right = -1;
        let bottom = -1;

        for (let y = 0; y < RUNNER_SPRITE_SHEET.frameHeight; y += 1) {
          for (let x = 0; x < RUNNER_SPRITE_SHEET.frameWidth; x += 1) {
            const alphaIndex = ((frameY + y) * source.width + frameX + x) * 4 + 3;
            if (data[alphaIndex] === 0) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }

        return { left, top, right, bottom };
      });
    },
    getStageTransitionTextResolutions: () => getScene()?.getStageTransitionTextResolutions() ?? [],
    setStage: (stageId) => getScene()?.forceStage(stageId),
    getMusicState: () => soundManager.getMusicState(),
    showFeedback: (kind) => {
      const feedback: GameFeedback =
        kind === 'injury'
          ? { text: '受傷：風險上升', tone: 'danger', durationMs: 1_400 }
          : kind === 'education'
            ? {
                text: '營養補給：體力恢復\n小提醒｜補給需求會受運動時間、環境與個人狀況影響。',
                tone: 'positive',
                durationMs: GAME_CONFIG.educationFeedbackDurationMs,
              }
            : { text: '營養補給：體力恢復', tone: 'positive', durationMs: 1_400 };
      gameEventBus.emit(GAME_EVENTS.feedback, feedback);
    },
    setHudStatusCount: (count) => {
      ui.updateHUD({
        statuses:
          count === 0
            ? []
            : [
                {
                  id: 'recovery-deficit',
                  icon: '🌡️',
                  label: '恢復不足',
                  remainingSeconds: 6,
                  tone: 'warning',
                },
                {
                  id: 'strength-protection',
                  icon: '🛡️',
                  label: '阻力防護',
                  remainingSeconds: 4,
                  tone: 'positive',
                },
                {
                  id: 'pace-zone2',
                  icon: '💚',
                  label: 'Zone 2 配速',
                  remainingSeconds: 5,
                  tone: 'positive',
                },
              ],
      });
    },
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

async function saveLatestResult(name: string): Promise<void> {
  if (latestResult === null) {
    ui.setScoreSaveError('目前沒有可儲存的成績。');
    return;
  }

  const resultSnapshot = latestResult;
  const generation = networkRunGeneration;
  const session = currentRunSession ?? (await runSessionPromise);
  if (session === null || generation !== networkRunGeneration) {
    ui.setScoreSaveError(
      networkRunError ?? '這一局未能連上驗證伺服器，仍可遊玩，但無法送上網路排行榜。',
    );
    return;
  }

  try {
    await checkpointQueue;
    await submitFinalCheckpoint(session, resultSnapshot, generation);

    const response = await leaderboardApi.finishRun(session.id, {
      token: session.token,
      name,
      elapsedSeconds: resultSnapshot.elapsedSeconds,
      collectedRecoveryItems: resultSnapshot.collectedRecoveryItems,
      outcome: resultSnapshot.outcome,
      stageId: resultSnapshot.stageId,
    });

    if (generation !== networkRunGeneration) return;
    currentLeaderboardEntryId = response.rank === null ? undefined : response.entry.id;
    currentRunSession = null;
    runSessionPromise = null;
    ui.setScoreSaved(response.rank, response.entry.name);
  } catch (error) {
    ui.setScoreSaveError(getNetworkErrorMessage(error));
  }
}

async function renderLeaderboard(): Promise<void> {
  const requestGeneration = ++leaderboardRequestGeneration;
  ui.setLeaderboardLoading();

  try {
    const response = await leaderboardApi.getLeaderboard();
    if (requestGeneration !== leaderboardRequestGeneration || !ui.isLeaderboardOpen()) return;

    const rows: LeaderboardRow[] = response.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      distanceMeters: entry.distanceMeters,
      outcome: entry.outcome,
    }));
    ui.showLeaderboard(rows, currentLeaderboardEntryId);
  } catch (error) {
    if (requestGeneration !== leaderboardRequestGeneration || !ui.isLeaderboardOpen()) return;
    ui.setLeaderboardError(getNetworkErrorMessage(error));
  }
}

function prepareNetworkRun(): void {
  const generation = ++networkRunGeneration;
  currentRunSession = null;
  networkRunError = null;
  nextCheckpointSeconds = CHECKPOINT_INTERVAL_SECONDS;
  lastCheckpointElapsedSeconds = 0;
  latestCompletionCheckpointCandidate = null;
  checkpointQueue = Promise.resolve();

  runSessionPromise = leaderboardApi
    .startRun()
    .then(({ run }) => {
      if (generation !== networkRunGeneration) return null;
      currentRunSession = run;
      return run;
    })
    .catch((error: unknown) => {
      if (generation === networkRunGeneration) {
        networkRunError = getNetworkErrorMessage(error);
        ui.showFeedback(`排行榜未連線：${networkRunError}`, 'danger', 3_000);
      }
      return null;
    });
}

function abandonNetworkRun(): void {
  networkRunGeneration += 1;
  currentRunSession = null;
  runSessionPromise = null;
  latestCompletionCheckpointCandidate = null;
  checkpointQueue = Promise.resolve();
}

function captureCompletionCheckpointCandidate(snapshot: HudSnapshot): void {
  if (
    snapshot.isPaused ||
    !isCompletionCheckpointTimingValid(snapshot.elapsedSeconds, getTotalMarathonDurationSeconds())
  ) {
    return;
  }

  latestCompletionCheckpointCandidate = {
    elapsedSeconds: snapshot.elapsedSeconds,
    collectedRecoveryItems: snapshot.collectedRecoveryItems,
  };
}

function queueNetworkCheckpoint(snapshot: HudSnapshot): void {
  if (
    snapshot.isPaused ||
    snapshot.elapsedSeconds >= PERIODIC_CHECKPOINT_CUTOFF_SECONDS ||
    snapshot.elapsedSeconds + 0.01 < nextCheckpointSeconds
  ) {
    return;
  }

  while (nextCheckpointSeconds <= snapshot.elapsedSeconds + 0.01) {
    nextCheckpointSeconds += CHECKPOINT_INTERVAL_SECONDS;
  }

  const generation = networkRunGeneration;
  const elapsedSeconds = snapshot.elapsedSeconds;
  const collectedRecoveryItems = snapshot.collectedRecoveryItems;
  checkpointQueue = checkpointQueue
    .then(async () => {
      if (generation !== networkRunGeneration) return;
      const session = currentRunSession ?? (await runSessionPromise);
      if (
        session === null ||
        generation !== networkRunGeneration ||
        elapsedSeconds <= lastCheckpointElapsedSeconds
      ) {
        return;
      }

      await leaderboardApi.submitCheckpoint(session.id, {
        token: session.token,
        elapsedSeconds,
        collectedRecoveryItems,
      });
      if (generation === networkRunGeneration) {
        lastCheckpointElapsedSeconds = elapsedSeconds;
        networkRunError = null;
      }
    })
    .catch((error: unknown) => {
      if (generation === networkRunGeneration) {
        networkRunError = getNetworkErrorMessage(error);
      }
    });
}

async function submitFinalCheckpoint(
  session: RunSession,
  result: GameOverResult,
  generation: number,
): Promise<void> {
  if (generation !== networkRunGeneration) {
    return;
  }

  let checkpoint: ClientCheckpointSnapshot | null = null;
  if (result.outcome === 'completed') {
    // A periodic request can be lost on a mobile connection. Keep a recent
    // snapshot and resend it before finish so pressing retry can self-heal.
    if (isCompletionCheckpointTimingValid(lastCheckpointElapsedSeconds, result.elapsedSeconds)) {
      return;
    }

    const candidate = latestCompletionCheckpointCandidate;
    if (
      candidate === null ||
      !isCompletionCheckpointTimingValid(candidate.elapsedSeconds, result.elapsedSeconds)
    ) {
      throw new LeaderboardApiError(
        'unprocessable',
        '完賽驗證資料未完整同步，請確認網路後按「重新儲存」。',
      );
    }
    checkpoint = candidate;
  } else if (result.elapsedSeconds > lastCheckpointElapsedSeconds) {
    checkpoint = {
      elapsedSeconds: result.elapsedSeconds,
      collectedRecoveryItems: result.collectedRecoveryItems,
    };
  }

  if (checkpoint === null) return;

  await leaderboardApi.submitCheckpoint(session.id, {
    token: session.token,
    elapsedSeconds: checkpoint.elapsedSeconds,
    collectedRecoveryItems: checkpoint.collectedRecoveryItems,
  });
  if (generation === networkRunGeneration) {
    lastCheckpointElapsedSeconds = checkpoint.elapsedSeconds;
    networkRunError = null;
  }
}

function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof LeaderboardApiError) return error.message;
  return '排行榜服務暫時無法使用，請稍後再試。';
}
