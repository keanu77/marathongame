import Phaser from 'phaser';

import { GAME_CONFIG } from '../config';
import type { MarathonStageId, ObstacleType, RecoveryItemType } from '../types';

const STAGE_ACCENTS: Record<MarathonStageId, number> = {
  base: 0x2a9d8f,
  build: 0x3b82c4,
  race: 0xf47b45,
};

const ITEM_ACCENTS: Record<RecoveryItemType, number> = {
  sleep: 0x8077d9,
  strength: 0xe76f51,
  nutrition: 0xf4b942,
  zone2: 0x2a9d8f,
  lsd: 0x277da1,
  interval: 0xe85d75,
};

const OBSTACLE_ACCENTS: Record<ObstacleType, number> = {
  illness: 0x8067a9,
  sportsInjury: 0xe56a54,
  overtraining: 0xd4495b,
};

/**
 * Lightweight runtime-drawn game feel effects. The class deliberately owns all
 * transient objects so restarting a run never leaves particles or tweens behind.
 */
export class RunEffects {
  private readonly transientObjects = new Set<Phaser.GameObjects.Container>();
  private readonly reducedMotion: boolean;

  public constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  public emitJump(x: number, groundY: number): void {
    const effect = this.createEffect(x - 6, groundY - 3, 3);
    const dust = this.scene.add.graphics();
    dust.fillStyle(0xffffff, 0.72);
    dust.fillEllipse(-16, 1, 22, 8);
    dust.fillEllipse(1, -1, 17, 7);
    dust.fillEllipse(14, 1, 12, 6);
    effect.add(dust);

    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: this.reducedMotion ? 1.05 : 1.55,
      scaleY: this.reducedMotion ? 0.9 : 0.62,
      x: x - 18,
      duration: this.reducedMotion ? 120 : 300,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public emitPickup(x: number, y: number, type: RecoveryItemType): void {
    const color = ITEM_ACCENTS[type];
    const effect = this.createEffect(x, y, 11);
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, color, 0.95);
    ring.strokeCircle(0, 0, 25);
    ring.lineStyle(2, 0xffffff, 0.9);
    ring.strokeCircle(0, 0, 18);

    const spark = this.scene.add.graphics();
    spark.lineStyle(4, color, 1);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      spark.beginPath();
      spark.moveTo(Math.cos(angle) * 31, Math.sin(angle) * 31);
      spark.lineTo(Math.cos(angle) * 41, Math.sin(angle) * 41);
      spark.strokePath();
    }

    effect.add([ring, spark]);
    effect.setScale(0.62);
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scale: this.reducedMotion ? 1 : 1.42,
      y: y - (this.reducedMotion ? 4 : 18),
      angle: this.reducedMotion ? 0 : 12,
      duration: this.reducedMotion ? 180 : 470,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public emitHit(x: number, y: number, type: ObstacleType): void {
    const color = OBSTACLE_ACCENTS[type];
    const effect = this.createEffect(x, y, 13);
    const impact = this.scene.add.graphics();
    impact.fillStyle(color, 0.18);
    impact.fillCircle(0, 0, 42);
    impact.lineStyle(5, color, 0.92);
    impact.strokeCircle(0, 0, 31);
    impact.lineStyle(5, 0xffffff, 0.9);
    impact.beginPath();
    impact.moveTo(-24, -20);
    impact.lineTo(-10, -7);
    impact.moveTo(21, -23);
    impact.lineTo(8, -8);
    impact.moveTo(-24, 20);
    impact.lineTo(-10, 7);
    impact.moveTo(21, 23);
    impact.lineTo(8, 8);
    impact.strokePath();
    effect.add(impact);

    effect.setScale(0.72);
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scale: this.reducedMotion ? 1 : 1.35,
      angle: this.reducedMotion ? 0 : -9,
      duration: this.reducedMotion ? 180 : 380,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public emitStage(stageId: MarathonStageId): void {
    if (this.reducedMotion) return;

    const effect = this.createEffect(0, 0, 20);
    const graphics = this.scene.add.graphics();
    const color = STAGE_ACCENTS[stageId];
    graphics.fillStyle(color, 0.1);
    graphics.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);
    graphics.fillStyle(color, 0.5);
    graphics.fillRoundedRect(GAME_CONFIG.canvasWidth + 20, 276, 230, 5, 3);
    graphics.fillRoundedRect(GAME_CONFIG.canvasWidth + 70, 300, 160, 3, 2);
    graphics.fillRoundedRect(GAME_CONFIG.canvasWidth + 45, 324, 195, 4, 2);
    effect.add(graphics);

    this.scene.tweens.add({
      targets: effect,
      x: -(GAME_CONFIG.canvasWidth + 200),
      alpha: 0,
      duration: 660,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public emitFinish(x: number, y: number): void {
    const effect = this.createEffect(x, y - 58, 14);
    const burst = this.scene.add.graphics();
    const colors = [0xf4b942, 0xf47b45, 0x2a9d8f, 0xffffff, 0x3b82c4] as const;

    burst.lineStyle(4, 0xffffff, 0.9);
    burst.strokeCircle(0, 0, 35);
    const count = this.reducedMotion ? 6 : 18;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const radius = 47 + (index % 3) * 10;
      const width = index % 2 === 0 ? 8 : 5;
      burst.fillStyle(colors[index % colors.length], 1);
      burst.fillRoundedRect(
        Math.cos(angle) * radius - width / 2,
        Math.sin(angle) * radius - 4,
        width,
        11,
        2,
      );
    }
    effect.add(burst);
    effect.setScale(0.6);

    this.scene.tweens.add({
      targets: effect,
      scale: this.reducedMotion ? 1 : 1.5,
      alpha: 0,
      angle: this.reducedMotion ? 0 : 18,
      y: y - (this.reducedMotion ? 62 : 92),
      duration: this.reducedMotion ? 260 : 900,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public emitStopped(x: number, y: number): void {
    const effect = this.createEffect(x, y - 48, 12);
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(4, 0xe56a54, 0.9);
    graphics.beginPath();
    graphics.moveTo(-30, -8);
    graphics.lineTo(-15, -8);
    graphics.moveTo(15, -8);
    graphics.lineTo(30, -8);
    graphics.strokePath();
    graphics.fillStyle(0xffffff, 0.75);
    graphics.fillEllipse(-23, 15, 16, 8);
    graphics.fillEllipse(2, 18, 22, 10);
    graphics.fillEllipse(25, 14, 13, 7);
    effect.add(graphics);

    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: this.reducedMotion ? 1 : 1.3,
      y: y - 58,
      duration: this.reducedMotion ? 180 : 520,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroyEffect(effect),
    });
  }

  public clear(): void {
    for (const object of this.transientObjects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy(true);
    }
    this.transientObjects.clear();
  }

  private createEffect(x: number, y: number, depth: number): Phaser.GameObjects.Container {
    const effect = this.scene.add.container(x, y).setDepth(depth);
    this.transientObjects.add(effect);
    return effect;
  }

  private destroyEffect(effect: Phaser.GameObjects.Container): void {
    this.transientObjects.delete(effect);
    if (effect.scene) effect.destroy(true);
  }
}
