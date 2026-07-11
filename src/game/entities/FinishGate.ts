import Phaser from 'phaser';

const FINISH_COLORS = {
  navy: 0x17324d,
  deepNavy: 0x10283d,
  teal: 0x2a9d8f,
  orange: 0xf47b45,
  gold: 0xf4b942,
  cream: 0xfff8ea,
  white: 0xffffff,
} as const;

/** Runtime-drawn finish arch. GameScene owns when it appears and what completion means. */
export class FinishGate extends Phaser.GameObjects.Container {
  private readonly startX: number;
  private readonly groundY: number;

  public constructor(scene: Phaser.Scene, startX: number, groundY: number) {
    super(scene, startX, groundY);

    this.startX = startX;
    this.groundY = groundY;
    this.name = 'marathon-finish-gate';
    this.setSize(142, 194);
    this.setDepth(4);
    scene.add.existing(this);

    this.drawFinishArch();
    this.reset();
  }

  public show(startX = this.startX): this {
    this.setPosition(startX, this.groundY);
    this.setActive(true).setVisible(true);
    return this;
  }

  public update(speed: number, deltaMs: number): void {
    if (!this.active || !Number.isFinite(speed) || !Number.isFinite(deltaMs)) return;
    this.x -= Math.max(0, speed) * (Math.max(0, deltaMs) / 1_000);
  }

  public reset(): this {
    this.setPosition(this.startX, this.groundY);
    this.setActive(false).setVisible(false);
    return this;
  }

  private drawFinishArch(): void {
    const graphics = this.scene.add.graphics();
    const { navy, deepNavy, teal, orange, gold, cream, white } = FINISH_COLORS;

    graphics.fillStyle(deepNavy, 0.24);
    graphics.fillEllipse(2, 5, 158, 15);

    graphics.fillStyle(orange, 1);
    graphics.fillRoundedRect(-75, -8, 34, 9, 4);
    graphics.fillRoundedRect(41, -8, 34, 9, 4);
    graphics.fillStyle(navy, 1);
    graphics.fillRoundedRect(-71, -160, 22, 158, 5);
    graphics.fillRoundedRect(49, -160, 22, 158, 5);
    graphics.lineStyle(2, cream, 0.82);
    graphics.strokeRoundedRect(-71, -160, 22, 158, 5);
    graphics.strokeRoundedRect(49, -160, 22, 158, 5);

    graphics.fillStyle(teal, 1);
    graphics.fillRoundedRect(-65, -153, 7, 143, 3);
    graphics.fillRoundedRect(58, -153, 7, 143, 3);
    graphics.fillStyle(orange, 1);
    for (let y = -137; y < -18; y += 32) {
      graphics.fillRoundedRect(-68, y, 16, 10, 3);
      graphics.fillRoundedRect(52, y + 16, 16, 10, 3);
    }

    graphics.lineStyle(2, cream, 0.8);
    graphics.beginPath();
    graphics.moveTo(-60, -193);
    graphics.lineTo(-60, -214);
    graphics.moveTo(60, -193);
    graphics.lineTo(60, -214);
    graphics.strokePath();
    graphics.fillStyle(orange, 1);
    graphics.fillTriangle(-59, -213, -59, -200, -43, -206);
    graphics.fillStyle(teal, 1);
    graphics.fillTriangle(59, -213, 59, -200, 43, -206);

    graphics.fillStyle(deepNavy, 0.28);
    graphics.fillRoundedRect(-74, -190, 152, 56, 11);
    graphics.fillStyle(orange, 1);
    graphics.fillRoundedRect(-77, -194, 154, 56, 11);
    graphics.fillStyle(navy, 1);
    graphics.fillRoundedRect(-73, -190, 146, 48, 8);
    graphics.fillStyle(teal, 1);
    graphics.fillRoundedRect(-69, -186, 138, 6, 3);
    graphics.lineStyle(1.5, white, 0.72);
    graphics.strokeRoundedRect(-69, -186, 138, 40, 6);

    this.drawCheckeredBand(graphics, -59, -150, 32, 6, navy, white);
    this.drawCheckeredBand(graphics, 27, -150, 32, 6, navy, white);
    graphics.fillStyle(gold, 1);
    graphics.fillRoundedRect(-23, -158, 46, 17, 9);
    graphics.lineStyle(1.5, cream, 0.9);
    graphics.strokeRoundedRect(-23, -158, 46, 17, 9);

    const finishLabel = this.scene.add
      .text(0, -170, 'FINISH', {
        color: '#fff8ea',
        fontFamily: 'system-ui, "Arial Black", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 2, '#10283d', 2, false, true);

    const finishLabelZh = this.scene.add
      .text(0, -149.5, '終點', {
        color: '#17324d',
        fontFamily: 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.add([graphics, finishLabel, finishLabelZh]);
  }

  private drawCheckeredBand(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    cellSize: number,
    dark: number,
    light: number,
  ): void {
    const columnCount = Math.floor(width / cellSize);
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        graphics.fillStyle((row + column) % 2 === 0 ? light : dark, 1);
        graphics.fillRect(x + column * cellSize, y + row * cellSize, cellSize, cellSize);
      }
    }
  }
}
