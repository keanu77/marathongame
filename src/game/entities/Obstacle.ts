import Phaser from 'phaser';

import { GAME_CONFIG } from '../config';
import { OBSTACLE_VISUAL_LABELS } from '../data';
import type { ObstacleType } from '../types';

export const ILLNESS_VISUAL_SIZE = { width: 68, height: 70 } as const;
export const ILLNESS_BODY_SIZE = { width: 52, height: 56 } as const;

interface ObstacleDimensions {
  visualWidth: number;
  visualHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  containerYOffset: number;
  visualCenterY: number;
}

/** Runtime geometry placeholder; replace drawPlaceholder with a sprite later. */
export class Obstacle extends Phaser.GameObjects.Container {
  public readonly obstacleType: ObstacleType;
  declare public body: Phaser.Physics.Arcade.Body;

  public constructor(scene: Phaser.Scene, x: number, groundY: number, type: ObstacleType) {
    const dimensions = Obstacle.getDimensions(type);
    super(scene, x, groundY - dimensions.bodyHeight / 2 + dimensions.containerYOffset);

    this.obstacleType = type;
    this.name = `obstacle-${type}`;
    this.setData('obstacleType', type);
    this.setSize(dimensions.bodyWidth, dimensions.bodyHeight);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(dimensions.bodyWidth, dimensions.bodyHeight);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.drawPlaceholder(type, dimensions);
  }

  public setScrollSpeed(speed: number): void {
    this.body.setVelocityX(-speed);
  }

  private drawPlaceholder(type: ObstacleType, dimensions: ObstacleDimensions): void {
    const graphics = this.scene.add.graphics();
    this.add(graphics);
    const { visualWidth, visualHeight, visualCenterY } = dimensions;

    switch (type) {
      case 'illness':
        this.drawIllness(graphics, visualWidth, visualHeight, visualCenterY);
        break;
      case 'sportsInjury':
        this.drawSportsInjury(graphics, visualWidth, visualHeight);
        break;
      case 'overtraining':
        this.drawOvertraining(graphics, visualWidth, visualHeight);
        break;
    }

    const isIllness = type === 'illness';
    const labelY = isIllness ? visualCenterY + visualHeight * 0.16 : visualHeight * 0.08;
    const label = this.scene.add.text(0, labelY, OBSTACLE_VISUAL_LABELS[type], {
      color: '#ffffff',
      backgroundColor: isIllness ? 'rgba(23, 50, 77, 0.92)' : undefined,
      fontFamily: 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      align: 'center',
      padding: isIllness ? { x: 5, y: 2 } : undefined,
      stroke: '#17324d',
      strokeThickness: isIllness ? 1 : 3,
    });
    label.setOrigin(0.5).setResolution(2);
    this.add(label);
  }

  private drawIllness(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    centerY: number,
  ): void {
    const shadowY = centerY + height / 2 - 5;
    graphics.fillStyle(0x24304f, 0.25);
    graphics.fillEllipse(0, shadowY, width - 6, 10);
    graphics.fillStyle(0x66508f, 1);
    graphics.fillCircle(0, centerY, 23);
    graphics.lineStyle(3.5, 0xb9a8e8, 1);

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const innerX = Math.cos(angle) * 20;
      const innerY = centerY + Math.sin(angle) * 20;
      const outerX = Math.cos(angle) * 30.5;
      const outerY = centerY + Math.sin(angle) * 30.5;
      graphics.beginPath();
      graphics.moveTo(innerX, innerY);
      graphics.lineTo(outerX, outerY);
      graphics.strokePath();
      graphics.fillCircle(outerX, outerY, 3.2);
    }

    graphics.fillStyle(0xf8f1ff, 1);
    graphics.fillCircle(-8, centerY - 4, 3.5);
    graphics.fillCircle(9, centerY + 5, 4.5);
    graphics.fillCircle(4, centerY - 12, 2.8);
  }

  private drawSportsInjury(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
  ): void {
    this.drawSignBody(graphics, width, height, 0xe56a54);
    graphics.save();
    graphics.rotateCanvas(-0.35);
    graphics.fillStyle(0xffe4bd, 1);
    graphics.fillRoundedRect(-25, -31, 50, 18, 8);
    graphics.lineStyle(2, 0xc98d63, 1);
    graphics.strokeRoundedRect(-25, -31, 50, 18, 8);
    graphics.fillStyle(0xe56a54, 0.7);
    for (let x = -15; x <= 15; x += 10) graphics.fillCircle(x, -22, 2);
    graphics.restore();
  }

  private drawOvertraining(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
  ): void {
    this.drawSignBody(graphics, width, height, 0xd4495b);
    graphics.lineStyle(5, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-24, -9);
    graphics.lineTo(-8, -25);
    graphics.lineTo(5, -13);
    graphics.lineTo(24, -35);
    graphics.strokePath();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(19, -38, 31, -41, 27, -28);
    graphics.fillStyle(0xffd166, 1);
    graphics.fillCircle(-21, -35, 5);
    graphics.fillCircle(-8, -35, 5);
    graphics.fillCircle(5, -35, 5);
  }

  private drawSignBody(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
  ): void {
    graphics.fillStyle(0x17324d, 1);
    graphics.fillRoundedRect(-4, height * 0.16, 8, height * 0.36, 4);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height * 0.72, 10);
    graphics.lineStyle(3, 0xffffff, 0.82);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height * 0.72, 10);
  }

  private static getDimensions(type: ObstacleType): ObstacleDimensions {
    switch (type) {
      case 'illness':
        return {
          visualWidth: ILLNESS_VISUAL_SIZE.width,
          visualHeight: ILLNESS_VISUAL_SIZE.height,
          bodyWidth: ILLNESS_BODY_SIZE.width,
          bodyHeight: ILLNESS_BODY_SIZE.height,
          containerYOffset: 0,
          visualCenterY: -7,
        };
      case 'sportsInjury':
        return {
          visualWidth: GAME_CONFIG.roadSignWidth,
          visualHeight: GAME_CONFIG.roadSignHeight,
          bodyWidth: GAME_CONFIG.roadSignWidth,
          bodyHeight: GAME_CONFIG.roadSignHeight,
          containerYOffset: 0,
          visualCenterY: 0,
        };
      case 'overtraining':
        return {
          visualWidth: GAME_CONFIG.roadSignWidth + 8,
          visualHeight: GAME_CONFIG.roadSignHeight + 8,
          bodyWidth: GAME_CONFIG.roadSignWidth + 8,
          bodyHeight: GAME_CONFIG.roadSignHeight + 8,
          containerYOffset: 0,
          visualCenterY: 0,
        };
    }
  }
}
