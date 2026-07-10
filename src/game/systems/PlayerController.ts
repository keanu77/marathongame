import Phaser from 'phaser';

import { GAME_CONFIG } from '../config';
import type { Player } from '../entities/Player';

export class PlayerController {
  private enabled = false;
  private jumpBufferRemainingMs = 0;
  private readonly jumpBufferDurationMs: number;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly jumpVelocity: number,
    private readonly onJump: () => void,
    jumpBufferSeconds: number = GAME_CONFIG.jumpBufferSeconds,
  ) {
    this.jumpBufferDurationMs =
      (Number.isFinite(jumpBufferSeconds) ? Math.max(0, jumpBufferSeconds) : 0) * 1_000;

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    scene.input.keyboard?.on('keydown-SPACE', this.handleKeyboard, this);
    scene.input.keyboard?.on('keydown-UP', this.handleKeyboard, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.jumpBufferRemainingMs = 0;
  }

  public tryJump(): void {
    if (!this.enabled) return;
    if (this.performJump()) return;

    this.jumpBufferRemainingMs = this.jumpBufferDurationMs;
  }

  /**
   * Keeps a short failed jump input alive until the player lands. Call once per
   * running frame so an input just before touchdown is not discarded.
   */
  public update(deltaMs: number): void {
    if (!this.enabled || this.jumpBufferRemainingMs <= 0) return;

    // Arcade Physics has already resolved landing for this frame. Try before
    // subtracting a long/slow frame so a valid touchdown input is not lost.
    if (this.performJump()) return;

    const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.jumpBufferRemainingMs = Math.max(0, this.jumpBufferRemainingMs - safeDeltaMs);
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

  private performJump(): boolean {
    if (!this.player.jump(this.jumpVelocity)) return false;

    this.jumpBufferRemainingMs = 0;
    this.onJump();
    return true;
  }

  private destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    this.scene.input.keyboard?.off('keydown-SPACE', this.handleKeyboard, this);
    this.scene.input.keyboard?.off('keydown-UP', this.handleKeyboard, this);
  }
}
