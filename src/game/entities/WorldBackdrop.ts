import Phaser from 'phaser';

import {
  getBackdropLighting,
  normalizeBackdropProgress,
  type BackdropLighting,
} from '../config/backdropLighting';
import type { MarathonStageId } from '../types';

type SceneryLayer = 'atmosphere' | 'far' | 'middle' | 'near' | 'ground' | 'lane';

interface SunLayout {
  x: number;
  y: number;
  radius: number;
}

const SUN_LAYOUTS: Record<MarathonStageId, SunLayout> = {
  base: { x: 100, y: 194, radius: 32 },
  build: { x: 456, y: 108, radius: 28 },
  race: { x: 104, y: 178, radius: 34 },
};

const TEXTURE_WIDTH = 720;
const SKY_GRADIENT_BANDS = 64;
const LIGHTING_PROGRESS_STEPS = 64;
const NIGHT_STARS = [
  { x: 38, y: 92, radius: 1.5 },
  { x: 76, y: 142, radius: 2.2 },
  { x: 126, y: 68, radius: 1.3 },
  { x: 172, y: 184, radius: 1.7 },
  { x: 212, y: 112, radius: 2.4 },
  { x: 264, y: 62, radius: 1.4 },
  { x: 304, y: 162, radius: 1.8 },
  { x: 348, y: 94, radius: 1.2 },
  { x: 390, y: 208, radius: 2.1 },
  { x: 438, y: 72, radius: 1.5 },
  { x: 492, y: 190, radius: 1.7 },
  { x: 520, y: 112, radius: 2.3 },
  { x: 56, y: 248, radius: 1.4 },
  { x: 146, y: 274, radius: 2 },
  { x: 246, y: 238, radius: 1.3 },
  { x: 334, y: 286, radius: 1.6 },
  { x: 466, y: 252, radius: 1.4 },
] as const;

function interpolateColor(start: number, end: number, progress: number): number {
  const startRed = (start >> 16) & 0xff;
  const startGreen = (start >> 8) & 0xff;
  const startBlue = start & 0xff;
  const endRed = (end >> 16) & 0xff;
  const endGreen = (end >> 8) & 0xff;
  const endBlue = end & 0xff;
  const red = Math.round(startRed + (endRed - startRed) * progress);
  const green = Math.round(startGreen + (endGreen - startGreen) * progress);
  const blue = Math.round(startBlue + (endBlue - startBlue) * progress);

  return (red << 16) | (green << 8) | blue;
}

function textureKey(stageId: MarathonStageId, layer: SceneryLayer): string {
  return `marathon-${stageId}-${layer}`;
}

export function getBackdropScrollDeltas(
  speed: number,
  deltaMs: number,
  renderScale = 1,
): Readonly<Record<SceneryLayer, number>> {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const safeSeconds = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) / 1_000 : 0;
  const safeRenderScale = Number.isFinite(renderScale) ? Math.max(1, renderScale) : 1;
  const logicalDistance = safeSpeed * safeSeconds;
  const highResolutionDistance = logicalDistance * safeRenderScale;

  return {
    atmosphere: logicalDistance * 0.025,
    far: logicalDistance * 0.07,
    middle: logicalDistance * 0.18,
    near: highResolutionDistance * 0.36,
    ground: highResolutionDistance,
    lane: highResolutionDistance,
  };
}

/**
 * Original code-native scenery for the three training stages.
 * Every shape is rendered at runtime with Phaser Graphics; no external art assets are used.
 */
export class WorldBackdrop {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly sun: Phaser.GameObjects.Graphics;
  private readonly horizon: Phaser.GameObjects.Graphics;
  private readonly timeOfDayOverlay: Phaser.GameObjects.Graphics;
  private readonly nightSkyDetails: Phaser.GameObjects.Graphics;
  private readonly atmosphere: Phaser.GameObjects.TileSprite;
  private readonly farScenery: Phaser.GameObjects.TileSprite;
  private readonly middleScenery: Phaser.GameObjects.TileSprite;
  private readonly nearScenery: Phaser.GameObjects.TileSprite;
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly laneMarks: Phaser.GameObjects.TileSprite;
  private readonly width: number;
  private readonly height: number;
  private readonly groundY: number;
  private readonly renderScale: number;
  private stageId: MarathonStageId = 'base';
  private lightingProgressStep = -1;

  public constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    groundY: number,
    renderScale: number,
  ) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;
    this.renderScale = Number.isFinite(renderScale) ? Math.max(1, renderScale) : 1;
    this.sky = scene.add.graphics().setDepth(-30);
    this.sun = scene.add.graphics().setDepth(-29);

    this.createTextures();

    // Distant layers use a 1× output canvas as a deliberate mobile-performance
    // LOD. Near scenery and the running surface use the selected output scale.
    this.atmosphere = scene.add
      .tileSprite(0, 70, width, 300, textureKey('base', 'atmosphere'))
      .setOrigin(0, 0)
      .setDepth(-28);
    this.farScenery = scene.add
      .tileSprite(0, groundY - 320, width, 320, textureKey('base', 'far'))
      .setOrigin(0, 0)
      .setDepth(-25);
    this.middleScenery = scene.add
      .tileSprite(0, groundY - 220, width, 220, textureKey('base', 'middle'))
      .setOrigin(0, 0)
      .setDepth(-21);
    this.nearScenery = scene.add
      .tileSprite(
        0,
        groundY - 112,
        width * this.renderScale,
        112 * this.renderScale,
        textureKey('base', 'near'),
      )
      .setOrigin(0, 0)
      .setScale(1 / this.renderScale)
      .setDepth(-15);
    this.ground = scene.add
      .tileSprite(
        0,
        groundY,
        width * this.renderScale,
        (height - groundY) * this.renderScale,
        textureKey('base', 'ground'),
      )
      .setOrigin(0, 0)
      .setScale(1 / this.renderScale)
      .setDepth(-10);
    this.laneMarks = scene.add
      .tileSprite(
        0,
        groundY + 42,
        width * this.renderScale,
        24 * this.renderScale,
        textureKey('base', 'lane'),
      )
      .setOrigin(0, 0)
      .setScale(1 / this.renderScale)
      .setDepth(-9);

    this.horizon = scene.add.graphics().setDepth(-8);
    // These dynamic layers sit above the cached scenery but below all gameplay
    // entities, so the evening treatment never reduces obstacle readability.
    this.timeOfDayOverlay = scene.add.graphics().setDepth(-7.5);
    this.nightSkyDetails = scene.add.graphics().setDepth(-7.25);
    this.setStage('base');
  }

  public setStage(stageId: MarathonStageId, stageProgress = 0): void {
    this.stageId = stageId;
    this.lightingProgressStep = -1;
    this.atmosphere.setTexture(textureKey(stageId, 'atmosphere'));
    this.farScenery.setTexture(textureKey(stageId, 'far'));
    this.middleScenery.setTexture(textureKey(stageId, 'middle'));
    this.nearScenery.setTexture(textureKey(stageId, 'near'));
    this.ground.setTexture(textureKey(stageId, 'ground'));
    this.laneMarks.setTexture(textureKey(stageId, 'lane'));
    this.setStageProgress(stageProgress);
  }

  public getStage(): MarathonStageId {
    return this.stageId;
  }

  public setStageProgress(stageProgress: number): void {
    const normalizedProgress = normalizeBackdropProgress(stageProgress);
    const lightingProgressStep =
      this.stageId === 'build' ? Math.round(normalizedProgress * LIGHTING_PROGRESS_STEPS) : 0;
    if (lightingProgressStep === this.lightingProgressStep) return;

    this.lightingProgressStep = lightingProgressStep;
    const quantizedProgress = lightingProgressStep / LIGHTING_PROGRESS_STEPS;
    this.applyLighting(getBackdropLighting(this.stageId, quantizedProgress));
  }

  public update(speed: number, deltaMs: number, stageProgress?: number): void {
    if (stageProgress !== undefined) this.setStageProgress(stageProgress);
    const scroll = getBackdropScrollDeltas(speed, deltaMs, this.renderScale);
    this.atmosphere.tilePositionX += scroll.atmosphere;
    this.farScenery.tilePositionX += scroll.far;
    this.middleScenery.tilePositionX += scroll.middle;
    this.nearScenery.tilePositionX += scroll.near;
    this.ground.tilePositionX += scroll.ground;
    this.laneMarks.tilePositionX += scroll.lane;
  }

  private applyLighting(lighting: BackdropLighting): void {
    this.sky.clear();
    this.drawCanvasSafeSky(lighting);
    this.drawSun(this.stageId, lighting);
    this.drawHorizon(this.stageId, lighting);
    this.drawTimeOfDayOverlay(lighting);
    this.drawNightSkyDetails(lighting);
  }

  private drawCanvasSafeSky(palette: BackdropLighting): void {
    const bandHeight = Math.ceil(this.groundY / SKY_GRADIENT_BANDS);

    for (let index = 0; index < SKY_GRADIENT_BANDS; index += 1) {
      const progress = index / (SKY_GRADIENT_BANDS - 1);
      this.sky.fillStyle(interpolateColor(palette.skyTop, palette.skyBottom, progress), 1);
      this.sky.fillRect(0, index * bandHeight, this.width, bandHeight + 1);
    }
  }

  private drawSun(stageId: MarathonStageId, palette: BackdropLighting): void {
    const layout = SUN_LAYOUTS[stageId];
    const x = stageId === 'base' ? layout.x : this.width - (540 - layout.x);
    const y = stageId === 'build' ? layout.y + palette.normalizedProgress * 154 : layout.y;
    const sunAlpha = palette.sunAlpha;

    this.sun.clear();
    if (sunAlpha <= 0) return;

    this.sun.fillStyle(palette.sunGlow, sunAlpha * (stageId === 'race' ? 0.24 : 0.17));
    this.sun.fillCircle(x, y, layout.radius + 34);
    this.sun.fillStyle(palette.sunGlow, sunAlpha * 0.32);
    this.sun.fillCircle(x, y, layout.radius + 16);
    this.sun.fillStyle(palette.sun, sunAlpha);
    this.sun.fillCircle(x, y, layout.radius);

    if (stageId === 'build') {
      this.sun.lineStyle(3, palette.sunGlow, sunAlpha * 0.48);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        this.sun.lineBetween(
          x + Math.cos(angle) * 42,
          y + Math.sin(angle) * 42,
          x + Math.cos(angle) * 54,
          y + Math.sin(angle) * 54,
        );
      }
    }
  }

  private drawHorizon(stageId: MarathonStageId, palette: BackdropLighting): void {
    this.horizon.clear();
    this.horizon.fillStyle(palette.horizon, 1);
    this.horizon.fillRect(0, this.groundY - 7, this.width, 8);

    if (stageId === 'base') {
      this.horizon.fillStyle(palette.horizonAccent, 1);
      for (let x = 0; x <= this.width; x += 14) {
        this.horizon.fillTriangle(
          x,
          this.groundY - 7,
          x + 5,
          this.groundY - 17 - ((x / 14) % 2) * 4,
          x + 10,
          this.groundY - 7,
        );
      }
      return;
    }

    if (stageId === 'build') {
      for (let x = 0; x <= this.width; x += 36) {
        this.horizon.fillStyle((x / 36) % 2 === 0 ? palette.horizonAccent : 0xf4fbff, 1);
        this.horizon.fillRect(x, this.groundY - 13, 36, 7);
      }
      return;
    }

    this.horizon.fillStyle(0xf7f0dc, 1);
    this.horizon.fillRect(0, this.groundY - 13, this.width, 6);
    for (let x = 0; x <= this.width; x += 48) {
      this.horizon.fillStyle((x / 48) % 2 === 0 ? palette.horizonAccent : 0xd94f4f, 1);
      this.horizon.fillRect(x, this.groundY - 13, 48, 6);
    }
  }

  private drawTimeOfDayOverlay(lighting: BackdropLighting): void {
    this.timeOfDayOverlay.clear();
    if (this.stageId !== 'build' || lighting.nightOverlayAlpha <= 0) return;

    this.timeOfDayOverlay.fillStyle(0x06162d, lighting.nightOverlayAlpha);
    this.timeOfDayOverlay.fillRect(0, 0, this.width, this.groundY);
    this.timeOfDayOverlay.fillStyle(0x04101f, lighting.nightOverlayAlpha * 0.66);
    this.timeOfDayOverlay.fillRect(0, this.groundY, this.width, this.height - this.groundY);
  }

  private drawNightSkyDetails(lighting: BackdropLighting): void {
    this.nightSkyDetails.clear();
    if (this.stageId !== 'build') return;

    if (lighting.nightOverlayAlpha > 0) {
      const floodlightAlpha = lighting.moonAlpha * 0.055;
      this.nightSkyDetails.fillStyle(0xcfefff, floodlightAlpha);
      this.nightSkyDetails.fillTriangle(
        34,
        this.groundY - 78,
        138,
        this.groundY - 380,
        242,
        this.groundY - 78,
      );
      this.nightSkyDetails.fillTriangle(
        this.width - 242,
        this.groundY - 78,
        this.width - 138,
        this.groundY - 380,
        this.width - 34,
        this.groundY - 78,
      );
    }

    if (lighting.starsAlpha > 0) {
      for (const [index, star] of NIGHT_STARS.entries()) {
        const alpha = lighting.starsAlpha * (index % 3 === 0 ? 0.94 : 0.7);
        this.nightSkyDetails.fillStyle(index % 4 === 0 ? 0xffefc2 : 0xd9edff, alpha);
        this.nightSkyDetails.fillCircle(star.x, star.y, star.radius);

        if (star.radius >= 2) {
          this.nightSkyDetails.lineStyle(1, 0xf5fbff, alpha * 0.62);
          this.nightSkyDetails.lineBetween(star.x - 4, star.y, star.x + 4, star.y);
          this.nightSkyDetails.lineBetween(star.x, star.y - 4, star.x, star.y + 4);
        }
      }
    }

    if (lighting.moonAlpha <= 0) return;

    const moonX = this.width - 102;
    const moonY = 122;
    this.nightSkyDetails.fillStyle(0xcfe8ff, lighting.moonAlpha * 0.14);
    this.nightSkyDetails.fillCircle(moonX, moonY, 34);
    this.nightSkyDetails.fillStyle(0xfff4c7, lighting.moonAlpha * 0.94);
    this.nightSkyDetails.fillCircle(moonX, moonY, 17);
    const skyAtMoon = interpolateColor(lighting.skyTop, lighting.skyBottom, moonY / this.groundY);
    const overlaidSkyAtMoon = interpolateColor(skyAtMoon, 0x06162d, lighting.nightOverlayAlpha);
    this.nightSkyDetails.fillStyle(overlaidSkyAtMoon, lighting.moonAlpha * 0.96);
    this.nightSkyDetails.fillCircle(moonX + 8, moonY - 6, 16);
  }

  private createTextures(): void {
    for (const stageId of ['base', 'build', 'race'] as const) {
      this.createStageTextures(stageId);
    }
  }

  private createStageTextures(stageId: MarathonStageId): void {
    this.createTexture(textureKey(stageId, 'atmosphere'), TEXTURE_WIDTH, 300, (graphics) => {
      this.drawAtmosphere(graphics, stageId);
    });
    this.createTexture(textureKey(stageId, 'far'), TEXTURE_WIDTH, 320, (graphics) => {
      this.drawFarScenery(graphics, stageId);
    });
    this.createTexture(textureKey(stageId, 'middle'), TEXTURE_WIDTH, 220, (graphics) => {
      this.drawMiddleScenery(graphics, stageId);
    });
    this.createTexture(
      textureKey(stageId, 'near'),
      TEXTURE_WIDTH,
      112,
      (graphics) => {
        this.drawNearScenery(graphics, stageId);
      },
      this.renderScale,
    );
    this.createTexture(
      textureKey(stageId, 'ground'),
      256,
      180,
      (graphics) => {
        this.drawGround(graphics, stageId);
      },
      this.renderScale,
    );
    this.createTexture(
      textureKey(stageId, 'lane'),
      180,
      24,
      (graphics) => {
        this.drawLane(graphics, stageId);
      },
      this.renderScale,
    );
  }

  private createTexture(
    key: string,
    width: number,
    height: number,
    draw: (graphics: Phaser.GameObjects.Graphics) => void,
    textureScale = 1,
  ): void {
    if (this.scene.textures.exists(key)) return;

    const graphics = this.scene.add.graphics();
    draw(graphics);
    graphics.setScale(textureScale);
    graphics.generateTexture(key, width * textureScale, height * textureScale);
    graphics.destroy();
  }

  private drawAtmosphere(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      this.drawCloud(graphics, 248, 78, 0.85, 0xffffff, 0.58);
      this.drawCloud(graphics, 608, 174, 0.62, 0xfff8df, 0.42);
      graphics.lineStyle(2, 0x37746c, 0.45);
      this.drawBird(graphics, 470, 80, 9);
      this.drawBird(graphics, 502, 101, 6);
      return;
    }

    if (stageId === 'build') {
      this.drawCloud(graphics, 138, 62, 0.65, 0xffffff, 0.52);
      this.drawCloud(graphics, 522, 146, 0.82, 0xeef8ff, 0.46);
      graphics.lineStyle(2, 0xffffff, 0.24);
      graphics.lineBetween(300, 64, 406, 64);
      graphics.lineBetween(318, 76, 448, 76);
      graphics.lineBetween(35, 194, 138, 194);
      return;
    }

    graphics.fillStyle(0xffe0a8, 0.2);
    graphics.fillRoundedRect(54, 76, 250, 8, 4);
    graphics.fillRoundedRect(388, 150, 208, 7, 4);
    graphics.fillStyle(0xfff5dc, 0.34);
    graphics.fillRoundedRect(160, 112, 190, 5, 3);
    graphics.lineStyle(2, 0x365f6c, 0.46);
    this.drawBird(graphics, 328, 64, 8);
    this.drawBird(graphics, 350, 76, 5);
  }

  private drawFarScenery(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      graphics.fillStyle(0xb5d9aa, 0.78);
      graphics.fillTriangle(0, 320, 126, 112, 278, 320);
      graphics.fillTriangle(190, 320, 392, 78, 600, 320);
      graphics.fillTriangle(520, 320, 646, 142, 720, 320);
      graphics.fillStyle(0xd8e6bb, 0.62);
      graphics.fillTriangle(326, 158, 392, 78, 464, 164);
      graphics.fillStyle(0x77aa82, 0.65);
      for (let x = 0; x < TEXTURE_WIDTH; x += 34) {
        const height = 25 + ((x / 34) % 3) * 9;
        graphics.fillCircle(x + 12, 320 - height, 24);
        graphics.fillRect(x, 320 - height, 30, height);
      }
      return;
    }

    if (stageId === 'build') {
      graphics.fillStyle(0xa6c7df, 0.62);
      graphics.fillTriangle(0, 320, 174, 142, 350, 320);
      graphics.fillTriangle(270, 320, 514, 110, 720, 320);
      this.drawSkyline(
        graphics,
        0x648eae,
        0.76,
        320,
        [86, 118, 74, 144, 96, 132, 80, 156, 104, 122, 92],
      );
      graphics.fillStyle(0xd9eff9, 0.6);
      for (let x = 16; x < TEXTURE_WIDTH; x += 64) {
        graphics.fillRect(x, 218 + ((x / 64) % 2) * 18, 7, 9);
        graphics.fillRect(x + 18, 218 + ((x / 64) % 2) * 18, 7, 9);
      }
      return;
    }

    graphics.fillStyle(0x9cbfc1, 0.42);
    graphics.fillTriangle(0, 320, 178, 154, 350, 320);
    graphics.fillTriangle(290, 320, 544, 124, 720, 320);
    this.drawSkyline(
      graphics,
      0x526f82,
      0.82,
      320,
      [112, 82, 158, 104, 184, 94, 136, 198, 116, 168, 90],
    );
    graphics.fillStyle(0xffd27c, 0.28);
    for (let x = 18; x < TEXTURE_WIDTH; x += 46) {
      graphics.fillRect(x, 234 + ((x / 46) % 3) * 16, 5, 7);
    }
  }

  private drawMiddleScenery(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      graphics.fillStyle(0x77c9cc, 0.74);
      graphics.fillRect(0, 115, TEXTURE_WIDTH, 105);
      graphics.fillStyle(0xd6f3e8, 0.52);
      for (let x = 18; x < TEXTURE_WIDTH; x += 72) {
        graphics.fillRoundedRect(x, 138 + ((x / 72) % 2) * 22, 40, 3, 2);
      }
      this.drawFootbridge(graphics, 54, 108, 210);
      this.drawFootbridge(graphics, 444, 124, 168);
      graphics.fillStyle(0x547c61, 0.76);
      for (const x of [18, 304, 350, 650]) this.drawTree(graphics, x, 129, 0.75);
      return;
    }

    if (stageId === 'build') {
      this.drawStadium(graphics);
      graphics.lineStyle(3, 0xe7f8ff, 0.7);
      graphics.lineBetween(0, 194, TEXTURE_WIDTH, 194);
      graphics.lineBetween(0, 204, TEXTURE_WIDTH, 204);
      graphics.lineStyle(2, 0x5ea6c7, 0.8);
      graphics.lineBetween(0, 214, TEXTURE_WIDTH, 214);
      this.drawFloodlight(graphics, 84, 188);
      this.drawFloodlight(graphics, 612, 188);
      return;
    }

    graphics.fillStyle(0x4b687a, 0.86);
    for (const building of [
      { x: 0, width: 92, height: 150 },
      { x: 106, width: 74, height: 116 },
      { x: 542, width: 76, height: 130 },
      { x: 630, width: 90, height: 164 },
    ]) {
      graphics.fillRoundedRect(
        building.x,
        220 - building.height,
        building.width,
        building.height,
        4,
      );
      graphics.fillStyle(0xffd88a, 0.3);
      for (let y = 220 - building.height + 18; y < 204; y += 26) {
        graphics.fillRect(building.x + 14, y, 9, 11);
        graphics.fillRect(building.x + 42, y, 9, 11);
      }
      graphics.fillStyle(0x4b687a, 0.86);
    }
    this.drawRaceBanner(graphics, 242, 90);
    this.drawRaceBanner(graphics, 402, 116);
    graphics.fillStyle(0x77aab2, 0.42);
    graphics.fillRect(180, 202, 362, 18);
  }

  private drawNearScenery(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      graphics.fillStyle(0x4f8d68, 0.95);
      graphics.fillRect(0, 91, TEXTURE_WIDTH, 21);
      for (let x = 0; x < TEXTURE_WIDTH; x += 52) {
        graphics.fillStyle((x / 52) % 2 === 0 ? 0x6eab70 : 0x83bb78, 0.94);
        graphics.fillCircle(x + 14, 88, 18);
        graphics.fillCircle(x + 31, 92, 14);
      }
      this.drawBench(graphics, 178, 88);
      this.drawParkLamp(graphics, 354, 94);
      this.drawBench(graphics, 558, 92);
      return;
    }

    if (stageId === 'build') {
      graphics.fillStyle(0x35799d, 0.78);
      graphics.fillRect(0, 94, TEXTURE_WIDTH, 18);
      graphics.lineStyle(3, 0xdaf4fb, 0.72);
      graphics.lineBetween(0, 89, TEXTURE_WIDTH, 89);
      graphics.lineBetween(0, 104, TEXTURE_WIDTH, 104);
      for (const x of [64, 250, 438, 624]) this.drawTrainingMarker(graphics, x, 94);
      this.drawFloodlight(graphics, 160, 100, 0.57);
      this.drawFloodlight(graphics, 530, 100, 0.57);
      return;
    }

    graphics.fillStyle(0xf2eee2, 0.98);
    graphics.fillRect(0, 83, TEXTURE_WIDTH, 29);
    graphics.fillStyle(0xc9484f, 0.92);
    for (let x = 0; x < TEXTURE_WIDTH; x += 72) {
      graphics.fillRect(x, 83, 36, 7);
      graphics.fillStyle(0xf1b943, 0.94);
      graphics.fillRect(x + 36, 83, 36, 7);
      graphics.fillStyle(0xc9484f, 0.92);
    }
    for (let x = 14; x < TEXTURE_WIDTH; x += 34) {
      this.drawSpectator(graphics, x, 76, Number((x / 34) % 4));
    }
    this.drawCourseFlag(graphics, 108, 72, 0xffc247);
    this.drawCourseFlag(graphics, 462, 72, 0xf05b57);
  }

  private drawGround(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      graphics.fillStyle(0xdde8df, 1);
      graphics.fillRect(0, 0, 256, 180);
      graphics.fillStyle(0xc9d8ce, 0.78);
      graphics.fillRect(0, 0, 256, 9);
      graphics.fillStyle(0xb9ccc1, 0.5);
      for (let x = 8; x < 256; x += 32) {
        graphics.fillCircle(x, 84 + ((x / 32) % 2) * 40, 2);
        graphics.fillRoundedRect(x + 12, 150 - ((x / 32) % 3) * 16, 14, 2, 1);
      }
      return;
    }

    if (stageId === 'build') {
      graphics.fillStyle(0x487e9b, 1);
      graphics.fillRect(0, 0, 256, 180);
      graphics.fillStyle(0x315f7a, 0.66);
      graphics.fillRect(0, 0, 256, 8);
      graphics.fillStyle(0x78a9bf, 0.34);
      for (let x = 0; x < 256; x += 48) {
        graphics.fillRoundedRect(x + 12, 106, 24, 3, 2);
        graphics.fillRoundedRect(x + 30, 154, 14, 2, 1);
      }
      return;
    }

    graphics.fillStyle(0x52515c, 1);
    graphics.fillRect(0, 0, 256, 180);
    graphics.fillStyle(0x3f3e49, 0.82);
    graphics.fillRect(0, 0, 256, 9);
    graphics.fillStyle(0x6d6a73, 0.45);
    for (let x = 4; x < 256; x += 28) {
      graphics.fillCircle(x, 116 + ((x / 28) % 3) * 16, 2);
      graphics.fillRoundedRect(x + 9, 160 - ((x / 28) % 2) * 22, 18, 2, 1);
    }
  }

  private drawLane(graphics: Phaser.GameObjects.Graphics, stageId: MarathonStageId): void {
    if (stageId === 'base') {
      graphics.fillStyle(0xffffff, 0.82);
      graphics.fillRoundedRect(0, 8, 82, 6, 3);
      return;
    }

    if (stageId === 'build') {
      graphics.fillStyle(0xd9f5ff, 0.84);
      graphics.fillRoundedRect(0, 5, 112, 4, 2);
      graphics.fillStyle(0x8dd1e7, 0.92);
      graphics.fillRoundedRect(0, 15, 112, 3, 2);
      return;
    }

    graphics.fillStyle(0xfff8df, 0.94);
    graphics.fillRoundedRect(0, 7, 94, 7, 3);
    graphics.fillStyle(0xffc44f, 0.64);
    graphics.fillTriangle(104, 4, 118, 11, 104, 18);
    graphics.fillTriangle(122, 4, 136, 11, 122, 18);
  }

  private drawCloud(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    scale: number,
    color: number,
    alpha: number,
  ): void {
    graphics.fillStyle(color, alpha);
    graphics.fillCircle(x - 25 * scale, y + 5 * scale, 18 * scale);
    graphics.fillCircle(x, y - 6 * scale, 27 * scale);
    graphics.fillCircle(x + 30 * scale, y + 5 * scale, 18 * scale);
    graphics.fillRoundedRect(x - 42 * scale, y + 1 * scale, 88 * scale, 24 * scale, 12 * scale);
  }

  private drawBird(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
  ): void {
    graphics.beginPath();
    graphics.moveTo(x - size, y);
    graphics.lineTo(x, y + size * 0.5);
    graphics.lineTo(x + size, y);
    graphics.strokePath();
  }

  private drawSkyline(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    alpha: number,
    baseline: number,
    heights: readonly number[],
  ): void {
    graphics.fillStyle(color, alpha);
    const width = TEXTURE_WIDTH / heights.length;
    heights.forEach((height, index) => {
      graphics.fillRoundedRect(index * width, baseline - height, width - 7, height, 4);
    });
  }

  private drawFootbridge(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
  ): void {
    graphics.lineStyle(6, 0xe8dec0, 0.9);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x + width * 0.22, y - 15);
    graphics.lineTo(x + width * 0.5, y - 24);
    graphics.lineTo(x + width * 0.78, y - 15);
    graphics.lineTo(x + width, y);
    graphics.strokePath();
    graphics.lineStyle(2, 0x55766d, 0.72);
    graphics.lineBetween(x, y - 9, x + width, y - 9);
    for (let postX = x + 12; postX < x + width; postX += 20) {
      graphics.lineBetween(postX, y - 15, postX, y + 7);
    }
  }

  private drawTree(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    baseline: number,
    scale: number,
  ): void {
    graphics.fillStyle(0x6e765b, 0.8);
    graphics.fillRect(x - 4 * scale, baseline - 38 * scale, 8 * scale, 38 * scale);
    graphics.fillStyle(0x4f8c65, 0.9);
    graphics.fillCircle(x - 12 * scale, baseline - 44 * scale, 21 * scale);
    graphics.fillCircle(x + 10 * scale, baseline - 52 * scale, 25 * scale);
    graphics.fillCircle(x + 24 * scale, baseline - 39 * scale, 18 * scale);
  }

  private drawStadium(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x5b90b2, 0.84);
    graphics.fillRoundedRect(176, 82, 370, 112, 36);
    graphics.fillStyle(0xd8edf6, 0.8);
    graphics.fillRoundedRect(204, 105, 314, 74, 28);
    graphics.fillStyle(0x5d9d80, 0.76);
    graphics.fillEllipse(361, 178, 264, 45);
    graphics.lineStyle(3, 0xffffff, 0.62);
    graphics.strokeEllipse(361, 178, 222, 30);
    graphics.fillStyle(0x3d708e, 0.72);
    for (let x = 212; x < 514; x += 28) graphics.fillRect(x, 121, 18, 7);
  }

  private drawFloodlight(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    baseline: number,
    scale = 1,
  ): void {
    graphics.lineStyle(4 * scale, 0x3e657b, 0.78);
    graphics.lineBetween(x, baseline, x + 5 * scale, baseline - 93 * scale);
    graphics.fillStyle(0xdff6ff, 0.86);
    graphics.fillRoundedRect(
      x - 14 * scale,
      baseline - 103 * scale,
      38 * scale,
      17 * scale,
      3 * scale,
    );
    graphics.fillStyle(0x7fb9d4, 0.86);
    for (let index = 0; index < 4; index += 1) {
      graphics.fillCircle(x - 7 * scale + index * 9 * scale, baseline - 95 * scale, 2.5 * scale);
    }
  }

  private drawRaceBanner(graphics: Phaser.GameObjects.Graphics, x: number, baseline: number): void {
    graphics.lineStyle(4, 0x4c3a55, 0.84);
    graphics.lineBetween(x, baseline, x, 206);
    graphics.fillStyle(0xffc44f, 0.9);
    graphics.fillTriangle(x + 2, baseline + 8, x + 52, baseline + 24, x + 2, baseline + 40);
    graphics.fillStyle(0xf3eee3, 0.7);
    graphics.fillCircle(x + 18, baseline + 24, 7);
  }

  private drawBench(graphics: Phaser.GameObjects.Graphics, x: number, baseline: number): void {
    graphics.fillStyle(0x7c6048, 0.88);
    graphics.fillRoundedRect(x, baseline - 22, 64, 8, 3);
    graphics.fillRoundedRect(x, baseline - 10, 64, 7, 3);
    graphics.fillRect(x + 8, baseline - 4, 5, 15);
    graphics.fillRect(x + 51, baseline - 4, 5, 15);
  }

  private drawParkLamp(graphics: Phaser.GameObjects.Graphics, x: number, baseline: number): void {
    graphics.fillStyle(0x496c68, 0.9);
    graphics.fillRect(x - 2, baseline - 68, 5, 68);
    graphics.fillStyle(0xffedb3, 0.9);
    graphics.fillCircle(x, baseline - 72, 9);
    graphics.fillStyle(0x41645f, 0.9);
    graphics.fillRoundedRect(x - 11, baseline - 82, 22, 5, 2);
  }

  private drawTrainingMarker(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    baseline: number,
  ): void {
    graphics.fillStyle(0xeaf9ff, 0.92);
    graphics.fillCircle(x, baseline - 14, 13);
    graphics.fillStyle(0x4ca0c6, 0.9);
    graphics.fillCircle(x, baseline - 14, 7);
    graphics.fillStyle(0xf2b84b, 0.9);
    graphics.fillRect(x - 3, baseline - 4, 6, 15);
  }

  private drawSpectator(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    baseline: number,
    variant: number,
  ): void {
    const shirtColors = [0x2f7f8b, 0xef765e, 0xf0bd48, 0x6c5f91];
    graphics.fillStyle(0x735141, 0.9);
    graphics.fillCircle(x, baseline - 33 - (variant % 2) * 4, 7);
    graphics.fillStyle(shirtColors[variant] ?? shirtColors[0], 0.94);
    graphics.fillRoundedRect(x - 8, baseline - 26 - (variant % 2) * 4, 16, 27, 5);
    if (variant === 1 || variant === 3) {
      graphics.lineStyle(3, shirtColors[variant] ?? shirtColors[0], 0.9);
      graphics.lineBetween(x - 4, baseline - 22, x - 12, baseline - 39);
    }
  }

  private drawCourseFlag(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    baseline: number,
    color: number,
  ): void {
    graphics.fillStyle(0x594658, 0.9);
    graphics.fillRect(x, baseline - 65, 4, 65);
    graphics.fillStyle(color, 0.95);
    graphics.fillTriangle(x + 4, baseline - 65, x + 42, baseline - 51, x + 4, baseline - 37);
  }
}
