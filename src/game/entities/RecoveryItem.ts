import Phaser from 'phaser';

import type { RecoveryItemType } from '../types';

const ITEM_COLORS: Record<RecoveryItemType, number> = {
  sleep: 0x7467c8,
  strength: 0xe76f51,
  nutrition: 0xf4b942,
  zone2: 0x2a9d8f,
  lsd: 0x277da1,
  interval: 0xe85d75,
};

const ITEM_ART_COLORS = {
  navy: 0x17324d,
  deepNavy: 0x10283d,
  cream: 0xfff8ea,
  white: 0xffffff,
} as const;

/** Cohesive runtime vector badges for recovery and training pickups. */
export class RecoveryItem extends Phaser.GameObjects.Container {
  public readonly itemType: RecoveryItemType;
  declare public body: Phaser.Physics.Arcade.Body;

  public constructor(scene: Phaser.Scene, x: number, y: number, type: RecoveryItemType) {
    super(scene, x, y);

    this.itemType = type;
    this.name = `item-${type}`;
    this.setData('itemType', type);
    this.setSize(54, 54);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCircle(27);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.drawItemBadge(type);
    if (!RecoveryItem.prefersReducedMotion()) {
      scene.tweens.add({
        targets: this,
        y: y - 8,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf(this);
    });
  }

  public setScrollSpeed(speed: number): void {
    this.body.setVelocityX(-speed);
  }

  private drawItemBadge(type: RecoveryItemType): void {
    const graphics = this.scene.add.graphics();
    const color = ITEM_COLORS[type];
    const { navy, deepNavy, cream, white } = ITEM_ART_COLORS;

    graphics.fillStyle(deepNavy, 0.2);
    graphics.fillEllipse(1, 5, 57, 49);
    graphics.fillStyle(color, 0.15);
    graphics.fillCircle(0, 0, 31);
    graphics.fillStyle(navy, 1);
    graphics.fillCircle(0, 0, 27);
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, 24);
    graphics.fillStyle(cream, 1);
    graphics.fillCircle(0, 0, 19.5);
    graphics.lineStyle(1.5, white, 0.72);
    graphics.strokeCircle(0, 0, 22);
    graphics.fillStyle(white, 0.72);
    graphics.fillEllipse(-7, -15, 11, 4);
    this.add(graphics);

    switch (type) {
      case 'sleep':
        this.drawSleep(graphics, color);
        break;
      case 'strength':
        this.drawStrength(graphics, color);
        break;
      case 'nutrition':
        this.drawNutrition(graphics, color);
        break;
      case 'zone2':
        this.drawZone2(graphics, color);
        break;
      case 'lsd':
        this.drawLsd(graphics, color);
        break;
      case 'interval':
        this.drawInterval(graphics, color);
        break;
    }
  }

  private drawSleep(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { cream, navy } = ITEM_ART_COLORS;
    graphics.fillStyle(color, 1);
    graphics.fillCircle(-2, -1, 12);
    graphics.fillStyle(cream, 1);
    graphics.fillCircle(4, -6, 11);
    graphics.fillStyle(navy, 1);
    graphics.fillTriangle(9, 6, 11, 10, 7, 10);
    graphics.fillTriangle(14, 1, 16, 5, 12, 5);
  }

  private drawStrength(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { navy } = ITEM_ART_COLORS;
    graphics.lineStyle(5, color, 1);
    graphics.beginPath();
    graphics.moveTo(-12, 0);
    graphics.lineTo(12, 0);
    graphics.strokePath();
    graphics.lineStyle(5, navy, 1);
    graphics.beginPath();
    graphics.moveTo(-15, -8);
    graphics.lineTo(-15, 8);
    graphics.moveTo(-10, -10);
    graphics.lineTo(-10, 10);
    graphics.moveTo(15, -8);
    graphics.lineTo(15, 8);
    graphics.moveTo(10, -10);
    graphics.lineTo(10, 10);
    graphics.strokePath();
  }

  private drawNutrition(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { cream, navy } = ITEM_ART_COLORS;
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-12, -15, 24, 30, 6);
    graphics.fillStyle(navy, 1);
    graphics.fillRoundedRect(-12, -15, 24, 6, 3);
    graphics.fillStyle(cream, 1);
    graphics.fillEllipse(0, 2, 9, 14);
    graphics.lineStyle(2, navy, 1);
    graphics.beginPath();
    graphics.moveTo(0, 8);
    graphics.lineTo(0, -4);
    graphics.lineTo(6, -8);
    graphics.strokePath();
  }

  private drawZone2(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { cream, navy } = ITEM_ART_COLORS;
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-16, -11, 32, 22, 8);
    graphics.lineStyle(2.5, cream, 1);
    graphics.beginPath();
    graphics.moveTo(-13, 2);
    graphics.lineTo(-8, 2);
    graphics.lineTo(-5, -4);
    graphics.lineTo(-1, 7);
    graphics.lineTo(3, 2);
    graphics.lineTo(7, 2);
    graphics.strokePath();
    this.addBadgeText('Z2', 10, -4, `#${navy.toString(16)}`, '9px');
  }

  private drawLsd(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { cream, navy } = ITEM_ART_COLORS;
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-16, -15, 32, 30, 10);
    graphics.fillStyle(cream, 1);
    graphics.fillTriangle(-12, 8, -3, -5, 2, 8);
    graphics.fillTriangle(-2, 8, 8, -9, 14, 8);
    graphics.lineStyle(2.5, navy, 1);
    graphics.beginPath();
    graphics.moveTo(-13, 9);
    graphics.lineTo(-6, 3);
    graphics.lineTo(0, 7);
    graphics.lineTo(10, -5);
    graphics.strokePath();
    this.addBadgeText('LSD', 0, -10, '#fff8ea', '8px');
  }

  private drawInterval(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const { cream, navy } = ITEM_ART_COLORS;
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 2, 15);
    graphics.fillRoundedRect(-5, -16, 10, 6, 3);
    graphics.fillRoundedRect(10, -11, 7, 4, 2);
    graphics.lineStyle(2.5, cream, 1);
    graphics.strokeCircle(0, 2, 10);
    graphics.beginPath();
    graphics.moveTo(0, 2);
    graphics.lineTo(6, -4);
    graphics.strokePath();
    graphics.fillStyle(navy, 1);
    graphics.fillCircle(0, 2, 2.2);
  }

  private addBadgeText(text: string, x: number, y: number, color: string, fontSize: string): void {
    const label = this.scene.add
      .text(x, y, text, {
        color,
        fontFamily: 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif',
        fontSize,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add(label);
  }

  private static prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
