import Phaser from 'phaser';

import type { RecoveryItemType } from '../types';

const ITEM_COLORS: Record<RecoveryItemType, number> = {
  sleep: 0x6f6ccf,
  strength: 0xe76f51,
  nutrition: 0xf4b942,
  zone2: 0x2a9d8f,
  lsd: 0x277da1,
  interval: 0xe85d75,
};

/** Runtime geometry placeholder; replace drawPlaceholder with a sprite later. */
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

    this.drawPlaceholder(type);
    scene.tweens.add({
      targets: this,
      y: y - 8,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf(this);
    });
  }

  public setScrollSpeed(speed: number): void {
    this.body.setVelocityX(-speed);
  }

  private drawPlaceholder(type: RecoveryItemType): void {
    const graphics = this.scene.add.graphics();
    const color = ITEM_COLORS[type];
    graphics.fillStyle(0xffffff, 0.98);
    graphics.fillCircle(0, 0, 27);
    graphics.lineStyle(4, color, 1);
    graphics.strokeCircle(0, 0, 24);
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
    graphics.fillStyle(color, 1);
    graphics.fillCircle(-2, -2, 14);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(5, -7, 13);
    graphics.fillStyle(0xffd166, 1);
    graphics.fillCircle(13, 11, 2.5);
  }

  private drawStrength(graphics: Phaser.GameObjects.Graphics, color: number): void {
    graphics.lineStyle(7, color, 1);
    graphics.beginPath();
    graphics.moveTo(-14, 0);
    graphics.lineTo(14, 0);
    graphics.strokePath();
    graphics.lineStyle(6, color, 1);
    graphics.beginPath();
    graphics.moveTo(-17, -9);
    graphics.lineTo(-17, 9);
    graphics.moveTo(-11, -11);
    graphics.lineTo(-11, 11);
    graphics.moveTo(17, -9);
    graphics.lineTo(17, 9);
    graphics.moveTo(11, -11);
    graphics.lineTo(11, 11);
    graphics.strokePath();
  }

  private drawNutrition(graphics: Phaser.GameObjects.Graphics, color: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-14, -18, 28, 36, 7);
    graphics.lineStyle(2.5, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-7, 5);
    graphics.lineTo(-1, -4);
    graphics.lineTo(5, 3);
    graphics.lineTo(10, -7);
    graphics.strokePath();
  }

  private drawZone2(graphics: Phaser.GameObjects.Graphics, color: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, 17);
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-12, 1);
    graphics.lineTo(-6, 1);
    graphics.lineTo(-2, -7);
    graphics.lineTo(4, 8);
    graphics.lineTo(8, 1);
    graphics.lineTo(13, 1);
    graphics.strokePath();
    this.addBadgeText('Z2', 0, 13, '#ffffff', '10px');
  }

  private drawLsd(graphics: Phaser.GameObjects.Graphics, color: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-17, -17, 34, 34, 11);
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-11, 11);
    graphics.lineTo(-4, 2);
    graphics.lineTo(2, 7);
    graphics.lineTo(11, -9);
    graphics.strokePath();
    this.addBadgeText('LSD', 0, -11, '#ffffff', '9px');
  }

  private drawInterval(graphics: Phaser.GameObjects.Graphics, color: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 2, 16);
    graphics.fillRoundedRect(-5, -20, 10, 6, 3);
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.strokeCircle(0, 2, 11);
    graphics.beginPath();
    graphics.moveTo(0, 2);
    graphics.lineTo(7, -4);
    graphics.moveTo(-7, 9);
    graphics.lineTo(-3, 5);
    graphics.strokePath();
  }

  private addBadgeText(text: string, x: number, y: number, color: string, fontSize: string): void {
    const label = this.scene.add
      .text(x, y, text, {
        color,
        fontFamily: 'system-ui, sans-serif',
        fontSize,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(label);
  }
}
