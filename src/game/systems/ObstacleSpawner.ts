import Phaser from 'phaser';

import { getMarathonStageConfig } from './marathonStageSystem';
import { Obstacle } from '../entities/Obstacle';
import type { MarathonStageId, ObstacleType } from '../types';
import {
  calculateObstacleSpawnDelayMs,
  applySpawnDelayMultiplier,
  getObstacleSpawnPool,
  isSpawnLaneClear,
  type StageSpawnPoolOverrides,
} from './spawnRules';

export interface ObstacleSpawnConfig {
  minDelayMs: number;
  maxDelayMs: number;
  initialDelayMs: number;
  minimumGapPixels: number;
  spawnX: number;
  despawnX: number;
  groundY: number;
  maximumConcurrent: number;
  stagePools?: StageSpawnPoolOverrides<ObstacleType>;
}

/**
 * One ground lane plus a speed-aware minimum gap guarantees that every pair of
 * obstacles leaves at least one complete jump/landing window.
 */
export class ObstacleSpawner {
  public readonly group: Phaser.Physics.Arcade.Group;
  private nextSpawnMs = 0;
  private active = false;
  private stageId: MarathonStageId = 'base';

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ObstacleSpawnConfig,
  ) {
    this.group = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
      runChildUpdate: false,
    });
    this.reset();
  }

  public start(): void {
    this.active = true;
    this.nextSpawnMs = applySpawnDelayMultiplier(
      this.config.initialDelayMs,
      this.getDelayMultiplier(),
    );
  }

  public setStage(stageId: MarathonStageId): void {
    this.stageId = stageId;
  }

  public getStage(): MarathonStageId {
    return this.stageId;
  }

  public stop(): void {
    this.active = false;
    for (const child of this.group.getChildren()) {
      (child as Obstacle).body.setVelocityX(0);
    }
  }

  public reset(): void {
    this.group.clear(true, true);
    this.active = false;
    this.nextSpawnMs = this.scaledRandomDelay();
  }

  public update(
    deltaMs: number,
    speed: number,
    recoveryLaneIsClear = true,
    _elapsedSeconds = 0,
  ): void {
    for (const child of this.group.getChildren()) {
      const obstacle = child as Obstacle;
      obstacle.setScrollSpeed(speed);
      if (obstacle.x < this.config.despawnX) obstacle.destroy();
    }

    if (!this.active) return;
    this.nextSpawnMs -= deltaMs;
    if (
      this.nextSpawnMs > 0 ||
      this.group.getLength() >= this.config.maximumConcurrent ||
      !recoveryLaneIsClear ||
      !this.hasSafeGap()
    ) {
      return;
    }

    const availableTypes = getObstacleSpawnPool(this.stageId, this.config.stagePools);
    if (availableTypes.length === 0) {
      this.nextSpawnMs = this.scaledRandomDelay();
      return;
    }

    const type = availableTypes[Phaser.Math.Between(0, availableTypes.length - 1)];
    const obstacle = new Obstacle(this.scene, this.config.spawnX, this.config.groundY, type);
    this.group.add(obstacle);
    obstacle.setScrollSpeed(speed);

    this.nextSpawnMs = calculateObstacleSpawnDelayMs({
      speed,
      sampledDelayMs: this.randomDelay(),
      minimumDelayMs: this.config.minDelayMs,
      minimumGapPixels: this.config.minimumGapPixels,
      delayMultiplier: this.getDelayMultiplier(),
    });
  }

  public isSpawnLaneClear(clearancePixels: number): boolean {
    return isSpawnLaneClear(
      this.group.getChildren().map((child) => (child as Obstacle).x),
      this.config.spawnX,
      clearancePixels,
    );
  }

  private hasSafeGap(): boolean {
    return this.isSpawnLaneClear(this.config.minimumGapPixels);
  }

  private randomDelay(): number {
    return Phaser.Math.Between(this.config.minDelayMs, this.config.maxDelayMs);
  }

  private scaledRandomDelay(): number {
    return applySpawnDelayMultiplier(this.randomDelay(), this.getDelayMultiplier());
  }

  private getDelayMultiplier(): number {
    return getMarathonStageConfig(this.stageId).obstacleSpawnDelayMultiplier;
  }
}
