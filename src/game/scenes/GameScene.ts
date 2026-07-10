import Phaser from 'phaser';

import { calculateValidatedScore } from '../../shared/networkLeaderboardRules';
import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import { MARATHON_STAGE_ENTRY_COPY } from '../data';
import { FinishGate } from '../entities/FinishGate';
import type { Obstacle } from '../entities/Obstacle';
import { Player } from '../entities/Player';
import type { RecoveryItem } from '../entities/RecoveryItem';
import { WorldBackdrop } from '../entities/WorldBackdrop';
import { GAME_EVENTS, gameEventBus } from '../events/GameEventBus';
import {
  advanceMarathonRunState,
  advanceProgress,
  applyMarathonObstacleImpact,
  applyMarathonRecoveryItem,
  createGameOverResult,
  createInitialMarathonRunState,
  createInitialProgress,
  createObstacleImpactCounts,
  determineMarathonOutcome,
  getDominantObstacle,
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
  private tutorialText!: Phaser.GameObjects.Text;
  private stageTransitionCard?: Phaser.GameObjects.Container;

  private runState: RunState = 'idle';
  private marathonState: MarathonRunState = createInitialMarathonRunState();
  private progress: GameProgress = createInitialProgress();
  private impactCounts: ObstacleImpactCounts = createObstacleImpactCounts();
  private invulnerableUntilMs = 0;
  private hudUpdateAccumulatorMs = 0;
  private soundEnabled = true;
  private hasCompletedFirstRunTutorial = false;
  private spawnSystemsStarted = false;
  private tutorialGateRemainingMs = 0;
  private finishApproachStarted = false;

  public constructor() {
    super({ key: GameScene.KEY });
  }

  public create(): void {
    const { canvasWidth, canvasHeight, groundY } = GAME_CONFIG;

    this.backdrop = new WorldBackdrop(this, canvasWidth, canvasHeight, groundY);
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
          color: '#17324d',
          backgroundColor: 'rgba(255,255,255,0.9)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '21px',
          fontStyle: 'bold',
          padding: { x: 16, y: 10 },
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
    this.player.updateRunner(deltaMs, isRunning);

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
    this.invulnerableUntilMs = 0;
    this.hudUpdateAccumulatorMs = 0;
    this.spawnSystemsStarted = false;
    this.finishApproachStarted = false;
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

    if (this.hasCompletedFirstRunTutorial) {
      this.startSpawnSystems();
      this.tutorialText.setAlpha(0);
    } else {
      this.showTutorialMessage('先試著跳一下！點畫面、跳躍鍵、空白鍵或 ↑');
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
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
    } else if (!shouldPause && this.runState === 'paused') {
      this.runState = 'running';
      this.time.paused = false;
      this.physics.world.resume();
      this.tweens.resumeAll();
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

  private setIdleState(): void {
    this.runState = 'idle';
    this.spawnSystemsStarted = false;
    this.finishApproachStarted = false;
    this.playerController?.setEnabled(false);
    this.obstacleSpawner?.reset();
    this.itemSpawner?.reset();
    this.finishGate?.reset();
    this.backdrop?.setStage('base');
    this.obstacleSpawner?.setStage('base');
    this.itemSpawner?.setStage('base');
    this.clearStageTransition();
    if (this.player) {
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
    gameEventBus.emit(GAME_EVENTS.sound, 'jump');

    if (!this.spawnSystemsStarted && this.runState === 'running') {
      this.hasCompletedFirstRunTutorial = true;
      this.startSpawnSystems();
      this.showTutorialMessage('很好！收集訓練道具，跳過身體警訊', GAME_CONFIG.tutorialDelayMs);
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
    this.finishGate.show();
    this.showTutorialMessage('終點就在前方！', GAME_CONFIG.stageTransitionDurationMs);
  }

  private handleObstacleHit(obstacle: Obstacle): void {
    if (this.runState !== 'running' || !obstacle.active) return;

    obstacle.body.enable = false;
    obstacle.setAlpha(0.3);
    this.time.delayedCall(GAME_CONFIG.hitFeedbackDestroyDelayMs, () => obstacle.destroy());

    if (this.time.now < this.invulnerableUntilMs) return;
    this.invulnerableUntilMs = this.time.now + GAME_CONFIG.hurtInvulnerabilitySeconds * 1_000;

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
    gameEventBus.emit(GAME_EVENTS.sound, 'hit');
    gameEventBus.emit(GAME_EVENTS.feedback, {
      text: this.getObstacleFeedback(obstacle.obstacleType, result),
      tone: 'danger',
      durationMs: GAME_CONFIG.feedbackDurationMs,
    });
    this.cameras.main.shake(
      GAME_CONFIG.cameraShakeDurationMs,
      GAME_CONFIG.cameraShakeIntensity,
      false,
    );
    this.emitHud();

    if (this.marathonState.outcome.status === 'didNotFinish') {
      this.finishRun(this.marathonState.outcome.reason as GameOverReason);
    }
  }

  private handleItemCollected(item: RecoveryItem): void {
    if (this.runState !== 'running' || !item.active) return;

    item.body.enable = false;
    item.destroy();

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

    gameEventBus.emit(GAME_EVENTS.sound, 'pickup');
    gameEventBus.emit(GAME_EVENTS.feedback, {
      text: this.getItemFeedback(item.itemType, result),
      tone: 'positive',
      durationMs: GAME_CONFIG.feedbackDurationMs,
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
    if (completed) this.player.markFinished();
    else this.player.markGameOver();
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

  private showTutorialMessage(text: string, holdMs?: number): void {
    this.tweens.killTweensOf(this.tutorialText);
    this.tutorialText
      .setText(text)
      .setAlpha(1)
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
    const card = this.add
      .container(GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2)
      .setDepth(24)
      .setAlpha(0)
      .setScale(0.92);
    this.stageTransitionCard = card;

    const veil = this.add.rectangle(0, 0, GAME_CONFIG.canvasWidth, 196, 0x17324d, 0.2);
    const panel = this.add
      .rectangle(0, 0, 382, 154, 0x17324d, 0.95)
      .setStrokeStyle(3, 0xffffff, 0.78);
    const counter = this.add
      .text(0, -48, `第 ${stageIndex + 1} 關／共 3 關`, {
        color: '#aee9dc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const title = this.add
      .text(0, -4, copy.title, {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 41, copy.subtitle, {
        color: '#d8f5ef',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    card.add([veil, panel, counter, title, subtitle]);

    this.tweens.add({
      targets: card,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: Math.max(0, GAME_CONFIG.stageTransitionDurationMs - 440),
      onComplete: () => {
        card.destroy();
        if (this.stageTransitionCard === card) this.stageTransitionCard = undefined;
      },
    });
  }

  private clearStageTransition(): void {
    const card = this.stageTransitionCard;
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

  private getItemFeedback(type: RecoveryItem['itemType'], result: RecoveryItemResult): string {
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
        return `間歇：加速 ${GAME_CONFIG.paceModes.interval.durationSeconds} 秒`;
    }
  }

  private formatEffectValue(value: number): string {
    return (Math.round(value * 10) / 10).toLocaleString('zh-TW');
  }
}
