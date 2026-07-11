import Phaser from 'phaser';

import type { RunKnowledgeItem } from '../../shared/education';
import { calculateValidatedScore } from '../../shared/networkLeaderboardRules';
import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import { normalizeRenderScale, type RenderScale } from '../config/gameConfig';
import { MARATHON_STAGE_ENTRY_COPY } from '../data';
import { FinishGate } from '../entities/FinishGate';
import type { Obstacle } from '../entities/Obstacle';
import { Player } from '../entities/Player';
import type { RecoveryItem } from '../entities/RecoveryItem';
import { RunEffects } from '../entities/RunEffects';
import { WorldBackdrop } from '../entities/WorldBackdrop';
import { GAME_EVENTS, gameEventBus } from '../events/GameEventBus';
import {
  advanceMarathonRunState,
  advanceProgress,
  advanceRemainingGameTimeMs,
  appendRunKnowledgeItem,
  applyMarathonObstacleImpact,
  applyMarathonRecoveryItem,
  createGameOverResult,
  createInitialMarathonRunState,
  createInitialProgress,
  createObstacleImpactCounts,
  determineMarathonOutcome,
  getDominantObstacle,
  getRunKnowledgeItemForObstacle,
  getRunKnowledgeItemForRecoveryItem,
  getMarathonEffectiveSpeedMultiplier,
  getMarathonStageSnapshot,
  getMarathonTotalDurationSeconds,
  readHighScore,
  recordObstacleImpact,
  updateHighScore,
} from '../systems';
import { CollisionSystem } from '../systems/CollisionSystem';
import { ItemSpawner } from '../systems/ItemSpawner';
import { ObstacleSpawner } from '../systems/ObstacleSpawner';
import { PlayerController } from '../systems/PlayerController';
import type {
  GameOverReason,
  GameOverResult,
  GameProgress,
  HudSnapshot,
  MarathonRunState,
  MarathonStageId,
  ObstacleImpactCounts,
  ObstacleImpactResult,
  ObstacleType,
  RecoveryItemResult,
} from '../types';

type RunState = 'idle' | 'running' | 'paused' | 'gameOver';

const STAGE_TRANSITION_THEME: Record<
  MarathonStageId,
  Readonly<{ accent: number; accentHex: string; phase: string; rhythm: string }>
> = {
  base: {
    accent: 0x57d6bb,
    accentHex: '#57d6bb',
    phase: 'FOUNDATION',
    rhythm: '130 BPM · 建立節奏',
  },
  build: {
    accent: 0x5eb8f2,
    accentHex: '#5eb8f2',
    phase: 'BUILD UP',
    rhythm: '150 BPM · 穩定加速',
  },
  race: {
    accent: 0xff8a4c,
    accentHex: '#ff8a4c',
    phase: 'RACE DAY',
    rhythm: '170 BPM · 奔向終點',
  },
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export class GameScene extends Phaser.Scene {
  public static readonly KEY = 'GameScene';

  private player!: Player;
  private ground!: Phaser.GameObjects.Rectangle;
  private backdrop!: WorldBackdrop;
  private finishGate!: FinishGate;
  private obstacleSpawner!: ObstacleSpawner;
  private itemSpawner!: ItemSpawner;
  private playerController!: PlayerController;
  private collisionSystem!: CollisionSystem;
  private runEffects!: RunEffects;
  private tutorialText!: Phaser.GameObjects.Text;
  private stageTransitionCard?: Phaser.GameObjects.Container;

  private runState: RunState = 'idle';
  private marathonState: MarathonRunState = createInitialMarathonRunState();
  private progress: GameProgress = createInitialProgress();
  private impactCounts: ObstacleImpactCounts = createObstacleImpactCounts();
  private invulnerabilityRemainingMs = 0;
  private invulnerabilityActivatedThisFrame = false;
  private knowledgeReview: readonly RunKnowledgeItem[] = [];
  private readonly encounteredKnowledgeIds = new Set<string>();
  private hudUpdateAccumulatorMs = 0;
  private soundEnabled = true;
  private hasCompletedFirstRunTutorial = false;
  private spawnSystemsStarted = false;
  private tutorialGateRemainingMs = 0;
  private finishApproachStarted = false;
  private successfulJumpCount = 0;

  private readonly renderScale: RenderScale;

  public constructor(renderScale: number = GAME_CONFIG.renderScale) {
    super({ key: GameScene.KEY });
    this.renderScale = normalizeRenderScale(renderScale);
  }

  public create(): void {
    const { canvasWidth, canvasHeight, groundY } = GAME_CONFIG;

    // Runtime backing-buffer density is adaptive. The 540 × 960 world and all
    // gameplay math stay unchanged regardless of the selected render scale.
    this.cameras.main.setZoom(this.renderScale);
    this.cameras.main.centerOn(canvasWidth / 2, canvasHeight / 2);
    this.physics.world.setBounds(0, 0, canvasWidth, canvasHeight);

    this.backdrop = new WorldBackdrop(this, canvasWidth, canvasHeight, groundY, this.renderScale);
    this.finishGate = new FinishGate(
      this,
      canvasWidth + GAME_CONFIG.finishGateSpawnOffsetPixels,
      groundY,
    );

    this.ground = this.add
      .rectangle(canvasWidth / 2, groundY + 30, canvasWidth + 80, 60, 0x000000, 0)
      .setDepth(-7);
    this.physics.add.existing(this.ground, true);

    this.player = new Player(
      this,
      GAME_CONFIG.playerStartX,
      groundY - GAME_CONFIG.playerHeight / 2,
      GAME_CONFIG.gravityY,
      GAME_CONFIG.playerWidth,
      GAME_CONFIG.playerHeight,
    ).setDepth(5);
    this.physics.add.collider(this.player, this.ground);
    this.runEffects = new RunEffects(this);

    const spawnX = canvasWidth + GAME_CONFIG.spawnAheadPixels;
    this.obstacleSpawner = new ObstacleSpawner(this, {
      minDelayMs: GAME_CONFIG.obstacleSpawnMinSeconds * 1_000,
      maxDelayMs: GAME_CONFIG.obstacleSpawnMaxSeconds * 1_000,
      initialDelayMs: GAME_CONFIG.firstObstacleSpawnDelaySeconds * 1_000,
      minimumGapPixels: GAME_CONFIG.minimumObstacleGapPixels,
      spawnX,
      despawnX: GAME_CONFIG.obstacleDespawnX,
      groundY,
      maximumConcurrent: GAME_CONFIG.maximumConcurrentObstacles,
    });
    this.itemSpawner = new ItemSpawner(
      this,
      {
        minDelayMs: GAME_CONFIG.recoverySpawnMinSeconds * 1_000,
        maxDelayMs: GAME_CONFIG.recoverySpawnMaxSeconds * 1_000,
        initialDelayMs: GAME_CONFIG.firstRecoverySpawnDelaySeconds * 1_000,
        initialItemType: GAME_CONFIG.firstRecoveryItemType,
        spawnX,
        despawnX: GAME_CONFIG.recoveryItemDespawnX,
        lowY: groundY - GAME_CONFIG.recoveryItemLowHeightAboveGround,
        highY: groundY - GAME_CONFIG.recoveryItemHighHeightAboveGround,
        obstacleClearancePixels: GAME_CONFIG.minimumObstacleRecoveryGapPixels,
      },
      (clearance) => this.obstacleSpawner.isSpawnLaneClear(clearance),
    );

    this.playerController = new PlayerController(
      this,
      this.player,
      Math.abs(GAME_CONFIG.jumpVelocity),
      () => this.handleSuccessfulJump(),
    );
    this.collisionSystem = new CollisionSystem(
      this,
      this.player,
      this.obstacleSpawner.group,
      this.itemSpawner.group,
      (obstacle) => this.handleObstacleHit(obstacle),
      (item) => this.handleItemCollected(item),
    );

    this.tutorialText = this.add
      .text(
        canvasWidth / 2,
        groundY - GAME_CONFIG.tutorialHeightAboveGround,
        '點一下畫面、空白鍵或 ↑ 跳躍',
        {
          color: '#ffffff',
          backgroundColor: 'rgba(7,29,49,0.88)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '19px',
          fontStyle: 'bold',
          resolution: this.renderScale,
          padding: { x: 18, y: 10 },
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);

    this.setIdleState();
    gameEventBus.emit(GAME_EVENTS.sceneReady);
  }

  public update(_time: number, deltaMs: number): void {
    const isRunning = this.runState === 'running';
    this.invulnerabilityRemainingMs = advanceRemainingGameTimeMs(
      this.invulnerabilityRemainingMs,
      deltaMs,
      isRunning,
      this.invulnerabilityActivatedThisFrame,
    );
    if (isRunning) this.invulnerabilityActivatedThisFrame = false;
    this.player.updateRunner(deltaMs, isRunning);
    if (isRunning) this.playerController.update(deltaMs);

    if (!isRunning) {
      if (this.runState === 'idle') {
        this.backdrop.update(GAME_CONFIG.idleBackdropSpeed, deltaMs);
      }
      return;
    }

    if (!this.spawnSystemsStarted) {
      this.tutorialGateRemainingMs -= deltaMs;
      if (this.tutorialGateRemainingMs <= 0) {
        this.hasCompletedFirstRunTutorial = true;
        this.startSpawnSystems();
        this.showTutorialMessage('收集訓練道具，跳過身體警訊', GAME_CONFIG.tutorialDelayMs);
      } else {
        this.backdrop.update(GAME_CONFIG.tutorialBackdropSpeed, deltaMs);
        return;
      }
    }

    const deltaSeconds = Math.min(deltaMs / 1_000, this.marathonState.stage.totalRemainingSeconds);
    const previousStageId = this.marathonState.stage.stageId;
    const speedMultiplier = getMarathonEffectiveSpeedMultiplier(
      previousStageId,
      this.marathonState.statusEffects,
    );

    this.progress = advanceProgress(this.progress, deltaSeconds, 0, GAME_CONFIG, speedMultiplier);
    this.marathonState = advanceMarathonRunState(this.marathonState, deltaSeconds);

    if (this.marathonState.stage.stageId !== previousStageId) {
      this.handleStageChanged(
        this.marathonState.stage.stageId,
        this.marathonState.stage.stageIndex,
      );
    }

    this.prepareFinishApproach();
    const effectiveSpeed = this.progress.speed;
    this.backdrop.update(effectiveSpeed, deltaMs);

    if (this.finishApproachStarted) {
      this.finishGate.update(effectiveSpeed, deltaMs);
    } else {
      this.obstacleSpawner.update(
        deltaMs,
        effectiveSpeed,
        this.itemSpawner.isSpawnLaneClear(GAME_CONFIG.minimumObstacleRecoveryGapPixels),
      );
      this.itemSpawner.update(deltaMs, effectiveSpeed);
    }

    this.hudUpdateAccumulatorMs += deltaMs;
    if (this.hudUpdateAccumulatorMs >= GAME_CONFIG.hudUpdateIntervalMs) {
      this.hudUpdateAccumulatorMs = 0;
      this.emitHud();
    }

    if (this.marathonState.outcome.status === 'finished') {
      this.finishRun(null);
    } else if (this.marathonState.outcome.status === 'didNotFinish') {
      this.finishRun(this.marathonState.outcome.reason as GameOverReason);
    }
  }

  public startRun(): void {
    this.physics.world.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.player.setAnimationPaused(false);

    this.marathonState = createInitialMarathonRunState();
    const initialSpeedMultiplier = getMarathonEffectiveSpeedMultiplier(
      this.marathonState.stage.stageId,
      this.marathonState.statusEffects,
    );
    this.progress = advanceProgress(
      createInitialProgress(),
      0,
      0,
      GAME_CONFIG,
      initialSpeedMultiplier,
    );
    this.impactCounts = createObstacleImpactCounts();
    this.invulnerabilityRemainingMs = 0;
    this.invulnerabilityActivatedThisFrame = false;
    this.knowledgeReview = [];
    this.encounteredKnowledgeIds.clear();
    this.runEffects.clear();
    this.hudUpdateAccumulatorMs = 0;
    this.spawnSystemsStarted = false;
    this.finishApproachStarted = false;
    this.successfulJumpCount = 0;
    this.tutorialGateRemainingMs = this.hasCompletedFirstRunTutorial
      ? 0
      : GAME_CONFIG.firstRunTutorialAutoStartSeconds * 1_000;

    this.obstacleSpawner.reset();
    this.itemSpawner.reset();
    this.finishGate.reset();
    this.configureStage(this.marathonState.stage.stageId);
    this.player.body.reset(
      GAME_CONFIG.playerStartX,
      GAME_CONFIG.groundY - GAME_CONFIG.playerHeight / 2,
    );
    this.player.body.setGravityY(GAME_CONFIG.gravityY);
    this.player.setRunnerState('running');

    this.runState = 'running';
    this.playerController.setEnabled(true);
    this.showStageTransition(this.marathonState.stage.stageId, 0);
    this.runEffects.emitStage(this.marathonState.stage.stageId);

    if (this.hasCompletedFirstRunTutorial) {
      this.startSpawnSystems();
      this.tutorialText.setAlpha(0);
    } else {
      this.showTutorialMessage('先跳一下！\n點畫面或按跳躍鍵');
    }

    gameEventBus.emit(GAME_EVENTS.runStarted);
    gameEventBus.emit(GAME_EVENTS.musicStageChanged, this.marathonState.stage.stageId);
    gameEventBus.emit(GAME_EVENTS.pauseChanged, false);
    this.emitHud();
  }

  public requestJump(): void {
    this.playerController.tryJump();
  }

  public togglePause(forcePaused?: boolean): void {
    if (this.runState !== 'running' && this.runState !== 'paused') return;
    const shouldPause = forcePaused ?? this.runState === 'running';

    if (shouldPause && this.runState === 'running') {
      this.runState = 'paused';
      this.playerController.setEnabled(false);
      this.player.setAnimationPaused(true);
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
    } else if (!shouldPause && this.runState === 'paused') {
      this.runState = 'running';
      this.time.paused = false;
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.player.setAnimationPaused(false);
      this.playerController.setEnabled(true);
    }

    gameEventBus.emit(GAME_EVENTS.pauseChanged, this.runState === 'paused');
    this.emitHud();
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.emitHud();
  }

  public returnHome(): void {
    this.physics.world.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.player.setAnimationPaused(false);
    this.setIdleState();
  }

  public forceGameOver(reason: 'energy' | 'injuryRisk' = 'energy'): void {
    if (this.runState !== 'running' && this.runState !== 'paused') return;
    if (this.runState === 'paused') this.togglePause(false);

    const vitals = {
      energy: reason === 'energy' ? 0 : this.marathonState.vitals.energy,
      injuryRisk: reason === 'injuryRisk' ? 100 : this.marathonState.vitals.injuryRisk,
    };
    this.marathonState = {
      ...this.marathonState,
      vitals,
      outcome: determineMarathonOutcome(vitals, this.marathonState.elapsedSeconds),
    };
    this.finishRun(reason === 'energy' ? 'energyDepleted' : 'injuryRiskMaxed');
  }

  public forceComplete(): void {
    if (this.runState !== 'running' && this.runState !== 'paused') return;
    if (this.runState === 'paused') this.togglePause(false);

    const elapsedSeconds = getMarathonTotalDurationSeconds();
    // The development-only completion control should exercise the same
    // checkpoint contract as a real 80-second run instead of bypassing it.
    const checkpointElapsedSeconds = elapsedSeconds - 10;
    this.marathonState = {
      ...this.marathonState,
      elapsedSeconds: checkpointElapsedSeconds,
      stage: getMarathonStageSnapshot(checkpointElapsedSeconds),
      outcome: { status: 'inProgress', reason: null },
    };
    this.emitHud();

    this.marathonState = {
      ...this.marathonState,
      elapsedSeconds,
      stage: getMarathonStageSnapshot(elapsedSeconds),
      outcome: { status: 'finished', reason: 'completedAllStages' },
    };
    this.finishRun(null);
  }

  public forceStage(stageId: MarathonStageId): void {
    if (this.runState !== 'running' && this.runState !== 'paused') return;

    const stageIndex = MARATHON_CONFIG.stages.findIndex((stage) => stage.id === stageId);
    if (stageIndex < 0) return;
    const elapsedSeconds = MARATHON_CONFIG.stages
      .slice(0, stageIndex)
      .reduce((total, stage) => total + stage.durationSeconds, 0);
    const previousStageId = this.marathonState.stage.stageId;
    this.marathonState = {
      ...this.marathonState,
      elapsedSeconds,
      stage: getMarathonStageSnapshot(elapsedSeconds),
      outcome: { status: 'inProgress', reason: null },
    };

    if (previousStageId !== stageId) {
      this.handleStageChanged(stageId, stageIndex);
    } else {
      gameEventBus.emit(GAME_EVENTS.musicStageChanged, stageId);
      this.emitHud();
    }
  }

  public getRunState(): RunState {
    return this.runState;
  }

  public getPlayerState(): string {
    return this.player.getRunnerState();
  }

  public getPlayerAnimationFrame(): number {
    return this.player.getAnimationFrameIndex();
  }

  public getSuccessfulJumpCount(): number {
    return this.successfulJumpCount;
  }

  public getStageTransitionTextResolutions(): number[] {
    const card = this.stageTransitionCard;
    if (!card) return [];

    const cardResolutions = card.list
      .filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text)
      .map((text) => text.style.resolution);
    return [this.tutorialText.style.resolution, ...cardResolutions];
  }

  private setIdleState(): void {
    this.runState = 'idle';
    this.spawnSystemsStarted = false;
    this.finishApproachStarted = false;
    this.successfulJumpCount = 0;
    this.invulnerabilityRemainingMs = 0;
    this.invulnerabilityActivatedThisFrame = false;
    this.knowledgeReview = [];
    this.encounteredKnowledgeIds.clear();
    this.runEffects?.clear();
    this.playerController?.setEnabled(false);
    this.obstacleSpawner?.reset();
    this.itemSpawner?.reset();
    this.finishGate?.reset();
    this.backdrop?.setStage('base');
    this.obstacleSpawner?.setStage('base');
    this.itemSpawner?.setStage('base');
    this.clearStageTransition();
    if (this.player) {
      this.player.setAnimationPaused(false);
      this.player.body.reset(
        GAME_CONFIG.playerStartX,
        GAME_CONFIG.groundY - GAME_CONFIG.playerHeight / 2,
      );
      this.player.body.setGravityY(GAME_CONFIG.gravityY);
      this.player.setRunnerState('idle');
    }
    this.tutorialText?.setAlpha(0);
  }

  private handleSuccessfulJump(): void {
    this.successfulJumpCount += 1;
    gameEventBus.emit(GAME_EVENTS.sound, 'jump');
    this.runEffects.emitJump(this.player.x, GAME_CONFIG.groundY);

    if (!this.spawnSystemsStarted && this.runState === 'running') {
      this.hasCompletedFirstRunTutorial = true;
      this.startSpawnSystems();
      this.showTutorialMessage(
        '很好！\n接著收集道具、跳過警訊',
        GAME_CONFIG.tutorialDelayMs,
        GAME_CONFIG.tutorialSuccessMessageX,
      );
    }
  }

  private startSpawnSystems(): void {
    if (this.spawnSystemsStarted) return;
    this.spawnSystemsStarted = true;
    this.configureStage(this.marathonState.stage.stageId);
    this.obstacleSpawner.start();
    this.itemSpawner.start();
  }

  private configureStage(stageId: MarathonStageId): void {
    this.backdrop.setStage(stageId);
    this.obstacleSpawner.setStage(stageId);
    this.itemSpawner.setStage(stageId);
  }

  private handleStageChanged(stageId: MarathonStageId, stageIndex: number): void {
    this.obstacleSpawner.reset();
    this.itemSpawner.reset();
    this.configureStage(stageId);

    if (this.spawnSystemsStarted) {
      this.obstacleSpawner.start();
      this.itemSpawner.start();
    }

    this.showStageTransition(stageId, stageIndex);
    this.runEffects.emitStage(stageId);
    gameEventBus.emit(GAME_EVENTS.musicStageChanged, stageId);
    this.emitHud();
  }

  private prepareFinishApproach(): void {
    if (
      this.finishApproachStarted ||
      this.marathonState.stage.stageId !== 'race' ||
      this.marathonState.stage.totalRemainingSeconds > MARATHON_CONFIG.finishGateLeadSeconds
    ) {
      return;
    }

    this.finishApproachStarted = true;
    this.obstacleSpawner.reset();
    this.itemSpawner.reset();
    const alignedStartX = Math.max(
      GAME_CONFIG.canvasWidth + GAME_CONFIG.finishGateSpawnOffsetPixels,
      this.player.x + this.progress.speed * this.marathonState.stage.totalRemainingSeconds,
    );
    this.finishGate.show(alignedStartX);
    this.showTutorialMessage('終點就在前方！', GAME_CONFIG.stageTransitionDurationMs);
  }

  private handleObstacleHit(obstacle: Obstacle): void {
    if (this.runState !== 'running' || !obstacle.active) return;

    obstacle.body.enable = false;
    obstacle.setAlpha(0.3);
    this.time.delayedCall(GAME_CONFIG.hitFeedbackDestroyDelayMs, () => obstacle.destroy());

    if (this.invulnerabilityRemainingMs > 0) return;
    this.invulnerabilityRemainingMs = GAME_CONFIG.hurtInvulnerabilitySeconds * 1_000;
    this.invulnerabilityActivatedThisFrame = true;

    const result = applyMarathonObstacleImpact(
      this.marathonState.vitals,
      this.marathonState.statusEffects,
      obstacle.obstacleType,
      this.marathonState.stage.stageId,
    );
    this.marathonState = {
      ...this.marathonState,
      vitals: result.vitals,
      statusEffects: result.statusEffects,
      outcome: determineMarathonOutcome(result.vitals, this.marathonState.elapsedSeconds),
    };
    this.impactCounts = recordObstacleImpact(this.impactCounts, obstacle.obstacleType);

    this.player.showHurt(GAME_CONFIG.hurtAnimationSeconds * 1_000);
    this.runEffects.emitHit(this.player.x + 12, this.player.y - 4, obstacle.obstacleType);
    const knowledgeItem = getRunKnowledgeItemForObstacle(obstacle.obstacleType);
    const feedback = this.addKnowledgeTip(
      this.getObstacleFeedback(obstacle.obstacleType, result),
      knowledgeItem,
    );
    gameEventBus.emit(GAME_EVENTS.sound, 'hit');
    gameEventBus.emit(GAME_EVENTS.feedback, {
      text: feedback.text,
      tone: 'danger',
      durationMs: feedback.durationMs,
    });
    if (!prefersReducedMotion()) {
      this.cameras.main.shake(
        GAME_CONFIG.cameraShakeDurationMs,
        GAME_CONFIG.cameraShakeIntensity / this.renderScale,
        false,
      );
    }
    this.emitHud();

    if (this.marathonState.outcome.status === 'didNotFinish') {
      this.finishRun(this.marathonState.outcome.reason as GameOverReason);
    }
  }

  private handleItemCollected(item: RecoveryItem): void {
    if (this.runState !== 'running' || !item.active) return;

    const itemX = item.x;
    const itemY = item.y;
    const itemType = item.itemType;
    item.body.enable = false;
    item.destroy();
    this.runEffects.emitPickup(itemX, itemY, itemType);

    const result = applyMarathonRecoveryItem(
      this.marathonState.vitals,
      this.marathonState.statusEffects,
      item.itemType,
      this.marathonState.stage.stageId,
    );
    this.marathonState = {
      ...this.marathonState,
      vitals: result.vitals,
      statusEffects: result.statusEffects,
    };
    const intervalSpawnAccelerated =
      item.itemType === 'interval' &&
      this.itemSpawner.accelerateNextSpawn(
        GAME_CONFIG.paceModes.interval.nextItemSpawnDelayMultiplier,
        this.getRemainingItemSpawnWindowMs(),
      );
    this.progress = advanceProgress(
      this.progress,
      0,
      1,
      GAME_CONFIG,
      getMarathonEffectiveSpeedMultiplier(
        this.marathonState.stage.stageId,
        this.marathonState.statusEffects,
      ),
    );

    const knowledgeItem = getRunKnowledgeItemForRecoveryItem(item.itemType);
    const feedback = this.addKnowledgeTip(
      this.getItemFeedback(item.itemType, result, intervalSpawnAccelerated),
      knowledgeItem,
    );
    gameEventBus.emit(GAME_EVENTS.sound, 'pickup');
    gameEventBus.emit(GAME_EVENTS.feedback, {
      text: feedback.text,
      tone: 'positive',
      durationMs: feedback.durationMs,
    });
    this.emitHud();
  }

  private finishRun(reason: GameOverReason | null): void {
    if (this.runState === 'gameOver') return;

    const completed = reason === null;
    this.runState = 'gameOver';
    this.playerController.setEnabled(false);
    this.obstacleSpawner.stop();
    this.itemSpawner.stop();
    this.clearStageTransition();
    if (completed) {
      this.player.markFinished();
      this.runEffects.emitFinish(this.player.x + 12, GAME_CONFIG.groundY);
    } else {
      this.player.markGameOver();
      this.runEffects.emitStopped(this.player.x, GAME_CONFIG.groundY);
    }
    this.player.setAnimationPaused(false);
    this.physics.world.pause();
    this.tutorialText.setAlpha(0);

    const dominantObstacle = completed ? null : getDominantObstacle(this.impactCounts);
    const elapsedSeconds = this.marathonState.elapsedSeconds;
    const collectedRecoveryItems = this.progress.collectedRecoveryItems;
    const score = calculateValidatedScore(elapsedSeconds, collectedRecoveryItems);
    const previousHighScore = readHighScore();
    const highScore = updateHighScore(score);
    const result: GameOverResult = createGameOverResult({
      reason,
      outcome: completed ? 'completed' : 'stopped',
      stageId: this.marathonState.stage.stageId,
      stageIndex: this.marathonState.stage.stageIndex,
      overallProgress: completed ? 1 : this.marathonState.stage.overallProgress,
      dominantObstacle,
      distanceMeters: this.getJourneyDistanceMeters(completed ? 1 : undefined),
      score,
      elapsedSeconds,
      collectedRecoveryItems,
      knowledgeReview: this.knowledgeReview,
      highScore,
      isNewHighScore: score > previousHighScore,
    });

    gameEventBus.emit(GAME_EVENTS.sound, completed ? 'finish' : 'gameOver');
    gameEventBus.emit(GAME_EVENTS.gameOver, result);
  }

  private emitHud(): void {
    const stage = this.marathonState.stage;
    const snapshot: HudSnapshot = {
      elapsedSeconds: this.marathonState.elapsedSeconds,
      distanceMeters: this.getJourneyDistanceMeters(),
      score: calculateValidatedScore(
        this.marathonState.elapsedSeconds,
        this.progress.collectedRecoveryItems,
      ),
      energy: Math.round(this.marathonState.vitals.energy),
      injuryRisk: Math.round(this.marathonState.vitals.injuryRisk),
      speed: Math.round(this.progress.speed),
      difficultyLevel: this.progress.difficultyLevel,
      stageId: stage.stageId,
      stageIndex: stage.stageIndex,
      overallProgress: stage.overallProgress,
      paceMode: this.marathonState.statusEffects.paceMode,
      statusEffects: this.marathonState.statusEffects,
      isPaused: this.runState === 'paused',
      isSoundEnabled: this.soundEnabled,
      collectedRecoveryItems: this.progress.collectedRecoveryItems,
    };
    gameEventBus.emit(GAME_EVENTS.hudUpdated, snapshot);
  }

  private getJourneyDistanceMeters(progress = this.marathonState.stage.overallProgress): number {
    return Math.round(Math.min(1, Math.max(0, progress)) * MARATHON_CONFIG.officialDistanceMeters);
  }

  private showTutorialMessage(
    text: string,
    holdMs?: number,
    x = GAME_CONFIG.canvasWidth / 2,
  ): void {
    this.tweens.killTweensOf(this.tutorialText);
    this.tutorialText
      .setText(text)
      .setAlpha(1)
      .setX(x)
      .setY(GAME_CONFIG.groundY - GAME_CONFIG.tutorialHeightAboveGround);

    if (holdMs === undefined) return;

    this.tweens.add({
      targets: this.tutorialText,
      alpha: 0,
      y:
        GAME_CONFIG.groundY -
        GAME_CONFIG.tutorialHeightAboveGround -
        GAME_CONFIG.tutorialRisePixels,
      delay: holdMs,
      duration: GAME_CONFIG.tutorialFadeDurationMs,
      ease: 'Sine.easeIn',
    });
  }

  private showStageTransition(stageId: MarathonStageId, stageIndex: number): void {
    this.clearStageTransition();
    const copy = MARATHON_STAGE_ENTRY_COPY[stageId];
    const theme = STAGE_TRANSITION_THEME[stageId];
    const card = this.add
      .container(GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2)
      .setDepth(24)
      .setAlpha(0)
      .setScale(prefersReducedMotion() ? 1 : 0.96);
    this.stageTransitionCard = card;
    gameEventBus.emit(GAME_EVENTS.stageTransitionChanged, true);

    const surface = this.add.graphics();
    surface.fillStyle(0x17324d, 0.26);
    surface.fillRect(-GAME_CONFIG.canvasWidth / 2, -116, GAME_CONFIG.canvasWidth, 232);
    surface.fillStyle(0x071d31, 0.32);
    surface.fillRoundedRect(-208, -86, 424, 180, 20);
    surface.fillStyle(0x17324d, 0.97);
    surface.fillRoundedRect(-214, -92, 424, 180, 20);
    surface.lineStyle(2, theme.accent, 0.92);
    surface.strokeRoundedRect(-214, -92, 424, 180, 20);
    surface.fillStyle(theme.accent, 1);
    surface.fillRoundedRect(-190, -92, 80, 5, 3);
    surface.fillCircle(-167, -37, 31);
    surface.lineStyle(2, 0xffffff, 0.32);
    surface.strokeCircle(-167, -37, 25);
    for (let index = 0; index < 3; index += 1) {
      const isReached = index <= stageIndex;
      surface.fillStyle(isReached ? theme.accent : 0x5a7188, isReached ? 1 : 0.48);
      surface.fillCircle(132 + index * 22, 66, isReached ? 5 : 4);
      if (index < 2) {
        surface.fillStyle(
          index < stageIndex ? theme.accent : 0x5a7188,
          index < stageIndex ? 1 : 0.35,
        );
        surface.fillRect(137 + index * 22, 64, 12, 3);
      }
    }

    const stageNumber = this.add
      .text(-167, -37, `${stageIndex + 1}`.padStart(2, '0'), {
        color: '#071d31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '21px',
        fontStyle: 'bold',
        resolution: this.renderScale,
      })
      .setOrigin(0.5);
    const counter = this.add
      .text(-122, -68, `${theme.phase}  ·  第 ${stageIndex + 1}／3 階段`, {
        color: theme.accentHex,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        resolution: this.renderScale,
      })
      .setOrigin(0, 0.5);
    const title = this.add
      .text(-122, -28, copy.title, {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        resolution: this.renderScale,
      })
      .setOrigin(0, 0.5);
    const subtitle = this.add
      .text(-122, 12, copy.subtitle, {
        color: '#d8f5ef',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        resolution: this.renderScale,
        wordWrap: { width: 288 },
      })
      .setOrigin(0, 0.5);
    const rhythm = this.add
      .text(-122, 56, theme.rhythm, {
        color: '#a9bfd2',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        resolution: this.renderScale,
      })
      .setOrigin(0, 0.5);
    card.add([surface, stageNumber, counter, title, subtitle, rhythm]);

    const onComplete = (): void => {
      card.destroy();
      if (this.stageTransitionCard === card) {
        this.stageTransitionCard = undefined;
        gameEventBus.emit(GAME_EVENTS.stageTransitionChanged, false);
      }
    };

    if (prefersReducedMotion()) {
      this.tweens.add({
        targets: card,
        alpha: 1,
        duration: 100,
        yoyo: true,
        hold: Math.max(0, GAME_CONFIG.stageTransitionDurationMs - 200),
        onComplete,
      });
      return;
    }

    this.tweens.add({
      targets: card,
      alpha: 1,
      scale: 1,
      y: GAME_CONFIG.canvasHeight / 2 - 6,
      duration: 260,
      ease: 'Cubic.easeOut',
      yoyo: true,
      hold: Math.max(0, GAME_CONFIG.stageTransitionDurationMs - 520),
      onComplete,
    });
  }

  private clearStageTransition(): void {
    const card = this.stageTransitionCard;
    gameEventBus.emit(GAME_EVENTS.stageTransitionChanged, false);
    if (!card) return;

    this.tweens.killTweensOf(card);
    card.destroy();
    this.stageTransitionCard = undefined;
  }

  private getObstacleFeedback(type: ObstacleType, result: ObstacleImpactResult): string {
    const energy = this.formatEffectValue(result.energyDamage);
    const risk = this.formatEffectValue(result.injuryRiskDamage);

    switch (type) {
      case 'illness':
        return `身體不適：體力 -${energy}・風險 +${risk}`;
      case 'sportsInjury':
        return `運動傷害：風險 +${risk}`;
      case 'overtraining':
        return `過度訓練：體力 -${energy}・風險 +${risk}`;
    }
  }

  private getItemFeedback(
    type: RecoveryItem['itemType'],
    result: RecoveryItemResult,
    intervalSpawnAccelerated = false,
  ): string {
    switch (type) {
      case 'sleep': {
        const recovered = this.formatEffectValue(result.energyRecovered);
        const reduced = this.formatEffectValue(result.injuryRiskReduced);
        return result.energyRecovered > 0 || result.injuryRiskReduced > 0
          ? `睡眠：體力 +${recovered}・風險 -${reduced}`
          : '睡眠：狀態已佳';
      }
      case 'strength':
        return `阻力訓練：防護 ${GAME_CONFIG.strengthProtectionSeconds} 秒`;
      case 'nutrition':
        return result.energyRecovered > 0
          ? `營養補給：體力 +${this.formatEffectValue(result.energyRecovered)}`
          : '營養補給：體力已滿';
      case 'zone2':
        return `Zone 2：省能 ${GAME_CONFIG.paceModes.zone2.durationSeconds} 秒`;
      case 'lsd':
        return `LSD 長距離慢跑：${GAME_CONFIG.paceModes.lsd.durationSeconds} 秒`;
      case 'interval':
        return intervalSpawnAccelerated
          ? `間歇：加速 ${GAME_CONFIG.paceModes.interval.durationSeconds} 秒・下一補給提前`
          : `間歇：加速 ${GAME_CONFIG.paceModes.interval.durationSeconds} 秒・高刺激高耗能`;
    }
  }

  private addKnowledgeTip(
    baseFeedback: string,
    knowledgeItem: RunKnowledgeItem,
  ): { text: string; durationMs: number } {
    if (this.encounteredKnowledgeIds.has(knowledgeItem.id)) {
      return { text: baseFeedback, durationMs: GAME_CONFIG.feedbackDurationMs };
    }

    this.encounteredKnowledgeIds.add(knowledgeItem.id);
    this.knowledgeReview = appendRunKnowledgeItem(this.knowledgeReview, knowledgeItem);
    return {
      text: `${baseFeedback}\n小提醒｜${knowledgeItem.message}`,
      durationMs: GAME_CONFIG.educationFeedbackDurationMs,
    };
  }

  private getRemainingItemSpawnWindowMs(): number {
    const finishLeadSeconds =
      this.marathonState.stage.stageId === 'race' ? MARATHON_CONFIG.finishGateLeadSeconds : 0;
    return Math.max(
      0,
      (this.marathonState.stage.totalRemainingSeconds - finishLeadSeconds) * 1_000 -
        GAME_CONFIG.spawnTransitionSafetyMs,
    );
  }

  private formatEffectValue(value: number): string {
    return (Math.round(value * 10) / 10).toLocaleString('zh-TW');
  }
}
