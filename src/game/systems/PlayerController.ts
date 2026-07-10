import Phaser from 'phaser';

import type { Player } from '../entities/Player';

export class PlayerController {
  private enabled = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly jumpVelocity: number,
    private readonly onJump: () => void,
  ) {
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    scene.input.keyboard?.on('keydown-SPACE', this.handleKeyboard, this);
    scene.input.keyboard?.on('keydown-UP', this.handleKeyboard, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public tryJump(): void {
    if (!this.enabled) return;
    if (this.player.jump(this.jumpVelocity)) this.onJump();
  }

  private handlePointer(): void {
    this.tryJump();
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (!this.enabled || this.isInteractiveElement(event.target)) return;

    event.preventDefault();
    if (event.repeat) return;
    this.tryJump();
  }

  private isInteractiveElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"]'));
  }

  private destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    this.scene.input.keyboard?.off('keydown-SPACE', this.handleKeyboard, this);
    this.scene.input.keyboard?.off('keydown-UP', this.handleKeyboard, this);
  }
}
