import Phaser from 'phaser';

import type { MarathonStageId } from '../types';

interface StagePalette {
  skyTop: number;
  skyBottom: number;
  sun: number;
  hillsTint: number;
  cityTint: number;
  groundTint: number;
  laneTint: number;
  horizon: number;
  accent: number;
}

const STAGE_PALETTES: Record<MarathonStageId, StagePalette> = {
  base: {
    skyTop: 0x9ee8ff,
    skyBottom: 0xdff4d4,
    sun: 0xffd166,
    hillsTint: 0xc8f0c1,
    cityTint: 0xa9d6cc,
    groundTint: 0xeaf3e8,
    laneTint: 0xffffff,
    horizon: 0x3b7b68,
    accent: 0x96c95d,
  },
  build: {
    skyTop: 0x91cffa,
    skyBottom: 0xdce9ff,
    sun: 0xffe49a,
    hillsTint: 0xaec9e9,
    cityTint: 0x77a5d5,
    groundTint: 0xc9d9e8,
    laneTint: 0xbfeaff,
    horizon: 0x376f98,
    accent: 0x63b3d1,
  },
  race: {
    skyTop: 0xffc98f,
    skyBottom: 0xffefd1,
    sun: 0xff944d,
    hillsTint: 0xe8b36f,
    cityTint: 0xcf725d,
    groundTint: 0xe5c0a2,
    laneTint: 0xfff0b5,
    horizon: 0x9b4d42,
    accent: 0xf2aa5c,
  },
};

/** Runtime-drawn placeholder scenery. No downloaded or third-party art assets. */
export class WorldBackdrop {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly sun: Phaser.GameObjects.Graphics;
  private readonly horizon: Phaser.GameObjects.Graphics;
  private readonly hills: Phaser.GameObjects.TileSprite;
  private readonly city: Phaser.GameObjects.TileSprite;
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly laneMarks: Phaser.GameObjects.TileSprite;
  private readonly width: number;
  private readonly groundY: number;
  private stageId: MarathonStageId = 'base';

  public constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    groundY: number,
  ) {
    this.width = width;
    this.groundY = groundY;
    this.sky = scene.add.graphics().setDepth(-20);
    this.sun = scene.add.graphics().setDepth(-19);

    this.createTextures();

    this.hills = scene.add
      .tileSprite(0, groundY - 215, width, 245, 'placeholder-hills')
      .setOrigin(0, 0)
      .setDepth(-17)
      .setAlpha(0.9);
    this.city = scene.add
      .tileSprite(0, groundY - 122, width, 150, 'placeholder-city')
      .setOrigin(0, 0)
      .setDepth(-15)
      .setAlpha(0.72);

    this.ground = scene.add
      .tileSprite(0, groundY, width, height - groundY, 'placeholder-ground')
      .setOrigin(0, 0)
      .setDepth(-10);
    this.laneMarks = scene.add
      .tileSprite(0, groundY + 44, width, 20, 'placeholder-lane')
      .setOrigin(0, 0)
      .setDepth(-9);

    this.horizon = scene.add.graphics().setDepth(-8);

    this.addAmbientClouds(width);
    this.setStage('base');
  }

  public setStage(stageId: MarathonStageId): void {
    this.stageId = stageId;
    const palette = STAGE_PALETTES[stageId];

    this.sky.clear();
    this.sky.fillGradientStyle(
      palette.skyTop,
      palette.skyTop,
      palette.skyBottom,
      palette.skyBottom,
      1,
    );
    this.sky.fillRect(0, 0, this.width, this.groundY);

    this.sun.clear();
    this.sun.fillStyle(palette.sun, 0.3);
    this.sun.fillCircle(this.width - 76, 118, 54);
    this.sun.fillStyle(palette.sun, 0.88);
    this.sun.fillCircle(this.width - 76, 118, 38);

    this.horizon.clear();
    this.horizon.fillStyle(palette.horizon, 1);
    this.horizon.fillRect(0, this.groundY - 7, this.width, 8);
    this.horizon.fillStyle(palette.accent, 1);
    for (let x = 0; x <= this.width; x += 16) {
      this.horizon.fillTriangle(
        x,
        this.groundY - 7,
        x + 6,
        this.groundY - 18,
        x + 12,
        this.groundY - 7,
      );
    }

    this.hills.setTint(palette.hillsTint);
    this.city.setTint(palette.cityTint);
    this.ground.setTint(palette.groundTint);
    this.laneMarks.setTint(palette.laneTint);
  }

  public getStage(): MarathonStageId {
    return this.stageId;
  }

  public update(speed: number, deltaMs: number): void {
    const seconds = deltaMs / 1_000;
    this.hills.tilePositionX += speed * 0.08 * seconds;
    this.city.tilePositionX += speed * 0.2 * seconds;
    this.ground.tilePositionX += speed * seconds;
    this.laneMarks.tilePositionX += speed * seconds;
  }

  private createTextures(): void {
    if (!this.scene.textures.exists('placeholder-hills')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x68b59b, 1);
      graphics.fillTriangle(0, 245, 130, 44, 270, 245);
      graphics.fillStyle(0x7bc4a3, 1);
      graphics.fillTriangle(170, 245, 360, 85, 540, 245);
      graphics.fillStyle(0xb5ddae, 0.7);
      graphics.fillTriangle(65, 145, 130, 44, 198, 145);
      graphics.generateTexture('placeholder-hills', 540, 245);
      graphics.destroy();
    }

    if (!this.scene.textures.exists('placeholder-city')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x467b78, 1);
      const buildings = [
        { x: 0, width: 54, height: 72 },
        { x: 65, width: 42, height: 108 },
        { x: 118, width: 68, height: 82 },
        { x: 200, width: 46, height: 120 },
        { x: 260, width: 78, height: 93 },
        { x: 350, width: 52, height: 128 },
        { x: 415, width: 85, height: 76 },
        { x: 512, width: 28, height: 103 },
      ];
      for (const building of buildings) {
        graphics.fillRoundedRect(
          building.x,
          150 - building.height,
          building.width,
          building.height,
          5,
        );
        graphics.fillStyle(0xffe7a8, 0.65);
        for (let windowY = 150 - building.height + 14; windowY < 142; windowY += 22) {
          graphics.fillRect(building.x + 10, windowY, 7, 8);
          if (building.width > 45) graphics.fillRect(building.x + 28, windowY, 7, 8);
        }
        graphics.fillStyle(0x467b78, 1);
      }
      graphics.generateTexture('placeholder-city', 540, 150);
      graphics.destroy();
    }

    if (!this.scene.textures.exists('placeholder-ground')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xdce7e5, 1);
      graphics.fillRect(0, 0, 256, 180);
      graphics.fillStyle(0xcad9d6, 0.7);
      for (let x = 0; x < 256; x += 32) {
        graphics.fillRect(x, 89, 16, 3);
        graphics.fillRect(x + 10, 135, 12, 3);
      }
      graphics.generateTexture('placeholder-ground', 256, 180);
      graphics.destroy();
    }

    if (!this.scene.textures.exists('placeholder-lane')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 0.75);
      graphics.fillRoundedRect(0, 7, 70, 6, 3);
      graphics.generateTexture('placeholder-lane', 120, 20);
      graphics.destroy();
    }
  }

  private addAmbientClouds(width: number): void {
    const cloudData = [
      { x: 72, y: 120, scale: 0.85, alpha: 0.62 },
      { x: width - 154, y: 265, scale: 1.05, alpha: 0.5 },
      { x: 188, y: 350, scale: 0.62, alpha: 0.42 },
    ];

    for (const cloud of cloudData) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, cloud.alpha);
      graphics.fillCircle(-22, 4, 17);
      graphics.fillCircle(1, -5, 25);
      graphics.fillCircle(28, 5, 16);
      graphics.fillRoundedRect(-38, 2, 79, 22, 11);
      graphics.setPosition(cloud.x, cloud.y).setScale(cloud.scale).setDepth(-18);
    }
  }
}
