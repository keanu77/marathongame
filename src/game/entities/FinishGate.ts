import Phaser from 'phaser';

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

    this.drawPlaceholder();
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

  private drawPlaceholder(): void {
    const graphics = this.scene.add.graphics();

    graphics.fillStyle(0x17324d, 0.22);
    graphics.fillEllipse(0, 5, 154, 16);

    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(-68, -178, 14, 178, 5);
    graphics.fillRoundedRect(54, -178, 14, 178, 5);
    graphics.fillStyle(0xe85d5d, 1);
    for (let y = -168; y < -10; y += 28) {
      graphics.fillRect(-68, y, 14, 14);
      graphics.fillRect(54, y + 14, 14, 14);
    }

    graphics.fillStyle(0x17324d, 1);
    graphics.fillRoundedRect(-73, -194, 146, 48, 9);
    const cellSize = 12;
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        graphics.fillStyle((row + column) % 2 === 0 ? 0xffffff : 0x17324d, 1);
        graphics.fillRect(-60 + column * cellSize, -190 + row * cellSize, cellSize, cellSize);
      }
    }

    const label = this.scene.add
      .text(0, -156, '終點 FINISH', {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add([graphics, label]);
  }
}
