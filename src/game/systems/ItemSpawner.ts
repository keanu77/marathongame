import Phaser from 'phaser';

import { RecoveryItem } from '../entities/RecoveryItem';
import type { MarathonStageId, RecoveryItemType } from '../types';
import { getMarathonStageConfig } from './marathonStageSystem';
import {
  accelerateSpawnCountdownMs,
  applySpawnDelayMultiplier,
  getItemSpawnPool,
  isSpawnLaneClear,
  type StageSpawnPoolOverrides,
} from './spawnRules';

export interface ItemSpawnConfig {
  minDelayMs: number;
  maxDelayMs: number;
  initialDelayMs: number;
  initialItemType?: RecoveryItemType;
  spawnX: number;
  despawnX: number;
  lowY: number;
  highY: number;
  obstacleClearancePixels: number;
  stagePools?: StageSpawnPoolOverrides<RecoveryItemType>;
}

export class ItemSpawner {
  public readonly group: Phaser.Physics.Arcade.Group;
  private nextSpawnMs = 0;
  private elapsedSinceLastSpawnMs = 0;
  private active = false;
  private isFirstSpawn = true;
  private stageId: MarathonStageId = 'base';

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ItemSpawnConfig,
    private readonly isObstacleLaneClear: (clearancePixels: number) => boolean,
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
    this.elapsedSinceLastSpawnMs = 0;
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
      (child as RecoveryItem).body.setVelocityX(0);
    }
  }

  public reset(): void {
    this.group.clear(true, true);
    this.active = false;
    this.isFirstSpawn = true;
    this.elapsedSinceLastSpawnMs = 0;
    this.nextSpawnMs = this.randomDelay();
  }

  public update(deltaMs: number, speed: number): void {
    for (const child of this.group.getChildren()) {
      const item = child as RecoveryItem;
      item.setScrollSpeed(speed);
      if (item.x < this.config.despawnX) item.destroy();
    }

    if (!this.active) return;
    this.elapsedSinceLastSpawnMs += Math.max(0, deltaMs);
    this.nextSpawnMs -= deltaMs;
    if (this.nextSpawnMs > 0) return;
    if (!this.isObstacleLaneClear(this.config.obstacleClearancePixels)) return;

    const availableTypes = getItemSpawnPool(this.stageId, this.config.stagePools);
    if (availableTypes.length === 0) {
      this.nextSpawnMs = this.randomDelay();
      return;
    }

    const preferredFirstType = this.config.initialItemType;
    const itemType =
      this.isFirstSpawn &&
      preferredFirstType !== undefined &&
      availableTypes.includes(preferredFirstType)
        ? preferredFirstType
        : availableTypes[Phaser.Math.Between(0, availableTypes.length - 1)];

    const item = new RecoveryItem(
      this.scene,
      this.config.spawnX,
      this.isFirstSpawn
        ? this.config.lowY
        : Phaser.Math.RND.pick([this.config.lowY, this.config.highY]),
      itemType,
    );
    this.isFirstSpawn = false;
    this.group.add(item);
    item.setScrollSpeed(speed);
    this.elapsedSinceLastSpawnMs = 0;
    this.nextSpawnMs = this.randomDelay();
  }

  /** 間歇訓練的高風險回報：提早下一個補給機會，但不突破合法最短間隔。 */
  public accelerateNextSpawn(
    multiplier: number,
    availableWindowMs = Number.POSITIVE_INFINITY,
  ): boolean {
    if (!this.active) return false;
    const minimumDelayMs = applySpawnDelayMultiplier(
      this.config.minDelayMs,
      this.getDelayMultiplier(),
    );
    const previousRemainingMs = this.nextSpawnMs;
    this.nextSpawnMs = accelerateSpawnCountdownMs(
      this.nextSpawnMs,
      this.elapsedSinceLastSpawnMs,
      minimumDelayMs,
      multiplier,
      availableWindowMs,
    );
    return this.nextSpawnMs < previousRemainingMs;
  }

  public isSpawnLaneClear(clearancePixels: number): boolean {
    return isSpawnLaneClear(
      this.group.getChildren().map((child) => (child as RecoveryItem).x),
      this.config.spawnX,
      clearancePixels,
    );
  }

  private randomDelay(): number {
    return applySpawnDelayMultiplier(
      Phaser.Math.Between(this.config.minDelayMs, this.config.maxDelayMs),
      this.getDelayMultiplier(),
    );
  }

  private getDelayMultiplier(): number {
    return getMarathonStageConfig(this.stageId).recoverySpawnDelayMultiplier;
  }
}
