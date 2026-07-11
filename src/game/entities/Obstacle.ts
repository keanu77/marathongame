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

const OBSTACLE_COLORS = {
  navy: 0x17324d,
  deepNavy: 0x10283d,
  teal: 0x2a9d8f,
  orange: 0xf47b45,
  coral: 0xe0565b,
  violet: 0x7467a8,
  lavender: 0xc9c1ed,
  gold: 0xf4b942,
  cream: 0xfff7e8,
  white: 0xffffff,
} as const;

/** Original runtime vector art; collision dimensions remain independent from the artwork. */
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

    this.drawObstacleArt(type, dimensions);
  }

  public setScrollSpeed(speed: number): void {
    this.body.setVelocityX(-speed);
  }

  private drawObstacleArt(type: ObstacleType, dimensions: ObstacleDimensions): void {
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
    const labelY = isIllness ? visualCenterY + 19 : -visualHeight / 2 + 53;
    const label = this.scene.add.text(0, labelY, OBSTACLE_VISUAL_LABELS[type], {
      color: '#fffaf0',
      fontFamily: 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif',
      fontSize: isIllness ? '17px' : '18px',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#10283d',
      strokeThickness: isIllness ? 0 : 2,
      resolution: 2,
    });
    label.setOrigin(0.5);
    this.add(label);
  }

  private drawIllness(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    centerY: number,
  ): void {
    const { navy, deepNavy, violet, lavender, cream, coral, white } = OBSTACLE_COLORS;
    const shadowY = centerY + height / 2 - 2;

    graphics.fillStyle(deepNavy, 0.22);
    graphics.fillEllipse(2, shadowY, width - 4, 9);

    graphics.fillStyle(violet, 0.14);
    graphics.fillCircle(0, centerY - 2, 31);

    graphics.lineStyle(5, lavender, 1);

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const innerX = Math.cos(angle) * 20;
      const innerY = centerY - 2 + Math.sin(angle) * 20;
      const outerX = Math.cos(angle) * 28;
      const outerY = centerY - 2 + Math.sin(angle) * 28;
      graphics.beginPath();
      graphics.moveTo(innerX, innerY);
      graphics.lineTo(outerX, outerY);
      graphics.strokePath();
      graphics.fillStyle(violet, 1);
      graphics.fillCircle(outerX, outerY, 3.5);
    }

    graphics.fillStyle(violet, 1);
    graphics.fillCircle(0, centerY - 2, 23);
    graphics.lineStyle(2.5, navy, 0.88);
    graphics.strokeCircle(0, centerY - 2, 23);

    graphics.fillStyle(cream, 1);
    graphics.fillCircle(-8, centerY - 7, 3.2);
    graphics.fillCircle(8, centerY - 7, 3.2);
    graphics.fillStyle(navy, 1);
    graphics.fillCircle(-8, centerY - 7, 1.5);
    graphics.fillCircle(8, centerY - 7, 1.5);
    graphics.lineStyle(2.5, coral, 1);
    graphics.beginPath();
    graphics.moveTo(-6, centerY + 5);
    graphics.lineTo(0, centerY + 2);
    graphics.lineTo(6, centerY + 5);
    graphics.strokePath();

    graphics.fillStyle(white, 0.72);
    graphics.fillCircle(-12, centerY - 16, 2.2);
    graphics.fillCircle(13, centerY + 1, 2.8);

    this.drawLabelPlate(graphics, 0, centerY + 19, 52, 23, violet);
  }

  private drawSportsInjury(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
  ): void {
    const { coral, cream, navy, orange } = OBSTACLE_COLORS;
    this.drawSignBody(graphics, width, height, coral);

    graphics.save();
    graphics.rotateCanvas(-0.35);
    graphics.fillStyle(cream, 1);
    graphics.fillRoundedRect(-22, -30, 44, 16, 8);
    graphics.lineStyle(2, navy, 0.72);
    graphics.strokeRoundedRect(-22, -30, 44, 16, 8);
    graphics.fillStyle(orange, 1);
    graphics.fillRoundedRect(-7, -30, 14, 16, 4);
    graphics.fillStyle(navy, 0.5);
    graphics.fillCircle(-14, -22, 1.6);
    graphics.fillCircle(14, -22, 1.6);
    graphics.restore();

    graphics.fillStyle(coral, 1);
    graphics.fillTriangle(24, -39, 30, -29, 18, -29);
  }

  private drawOvertraining(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
  ): void {
    const { coral, cream, gold, navy, orange } = OBSTACLE_COLORS;
    this.drawSignBody(graphics, width, height, coral);

    graphics.fillStyle(navy, 0.34);
    graphics.fillRoundedRect(-25, -35, 7, 18, 2);
    graphics.fillRoundedRect(-11, -32, 7, 15, 2);
    graphics.fillRoundedRect(3, -28, 7, 11, 2);

    graphics.lineStyle(4, cream, 1);
    graphics.beginPath();
    graphics.moveTo(-25, -19);
    graphics.lineTo(-10, -31);
    graphics.lineTo(3, -23);
    graphics.lineTo(24, -38);
    graphics.strokePath();
    graphics.fillStyle(gold, 1);
    graphics.fillTriangle(18, -41, 30, -42, 26, -30);

    graphics.fillStyle(orange, 1);
    graphics.fillCircle(-22, -38, 3.2);
    graphics.fillCircle(-11, -39, 3.2);
    graphics.fillCircle(0, -39, 3.2);
  }

  private drawSignBody(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
  ): void {
    const { navy, deepNavy, teal, cream } = OBSTACLE_COLORS;
    const panelY = -height / 2;
    const panelHeight = height * 0.72;

    graphics.fillStyle(deepNavy, 0.22);
    graphics.fillEllipse(2, height / 2 - 1, width * 0.74, 9);

    graphics.fillStyle(navy, 1);
    graphics.fillRoundedRect(-5, height * 0.13, 10, height * 0.39, 4);
    graphics.fillRoundedRect(-15, height / 2 - 6, 30, 6, 3);
    graphics.fillStyle(teal, 1);
    graphics.fillRoundedRect(-3, height * 0.17, 6, height * 0.28, 3);

    graphics.fillStyle(deepNavy, 0.28);
    graphics.fillRoundedRect(-width / 2 + 3, panelY + 4, width, panelHeight, 11);
    graphics.fillStyle(navy, 1);
    graphics.fillRoundedRect(-width / 2, panelY, width, panelHeight, 11);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-width / 2, panelY, width, 8, 8);
    graphics.lineStyle(3, color, 1);
    graphics.strokeRoundedRect(-width / 2, panelY, width, panelHeight, 11);
    graphics.lineStyle(1.5, cream, 0.72);
    graphics.strokeRoundedRect(-width / 2 + 4, panelY + 4, width - 8, panelHeight - 8, 8);
  }

  private drawLabelPlate(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
  ): void {
    const { deepNavy, cream } = OBSTACLE_COLORS;
    graphics.fillStyle(deepNavy, 0.95);
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    graphics.lineStyle(2, accent, 1);
    graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    graphics.lineStyle(1, cream, 0.46);
    graphics.strokeRoundedRect(
      x - width / 2 + 3,
      y - height / 2 + 3,
      width - 6,
      height - 6,
      height / 2 - 3,
    );
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
