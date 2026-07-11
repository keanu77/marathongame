import Phaser from 'phaser';

import {
  getRunnerAnimationFrame,
  getRunnerJumpFrame,
  RUNNER_ANIMATION_SPECS,
  RUNNER_SPRITE_SHEET,
  type RunnerAirPhase,
  type RunnerAnimationState,
} from '../config/runnerAnimationConfig';
import { drawRunnerFrame, drawRunnerSpriteSheet } from './RunnerFrameRenderer';

export type RunnerState = RunnerAnimationState;
export type { RunnerAirPhase } from '../config/runnerAnimationConfig';

export const RUNNER_ANIMATION_TIMING = {
  runCycleMs: RUNNER_ANIMATION_SPECS.running.durationMs ?? 660,
  takeoffExtensionMs: 45,
} as const;

const AIRBORNE_VELOCITY_THRESHOLD = 160;
const GENERATED_SHEET_KEY = `${RUNNER_SPRITE_SHEET.textureKey}-vector-v2`;

/** A same-leg cycle of 660 ms produces a natural distance-running cadence near 182 spm. */
export function getRunnerRunCyclePhase(timeMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  return (timeMs % RUNNER_ANIMATION_TIMING.runCycleMs) / RUNNER_ANIMATION_TIMING.runCycleMs;
}

/** Resolve a readable airborne silhouette without coupling animation to scene rules. */
export function getRunnerAirPhase(velocityY: number, stateElapsedMs: number): RunnerAirPhase {
  const elapsedMs = Number.isFinite(stateElapsedMs) ? Math.max(0, stateElapsedMs) : 0;
  const safeVelocityY = Number.isFinite(velocityY) ? velocityY : 0;
  if (safeVelocityY > AIRBORNE_VELOCITY_THRESHOLD) return 'descent';
  if (safeVelocityY >= -AIRBORNE_VELOCITY_THRESHOLD) return 'apex';
  if (elapsedMs < RUNNER_ANIMATION_TIMING.takeoffExtensionMs) return 'takeoff';
  return 'ascent';
}

export function getRunnerResumeAnimationElapsed(state: RunnerState): number {
  return state === 'jumping' ? RUNNER_ANIMATION_TIMING.takeoffExtensionMs : 0;
}

function hasCompleteRunnerSheet(scene: Phaser.Scene, textureKey: string): boolean {
  if (!scene.textures.exists(textureKey)) return false;
  const texture = scene.textures.get(textureKey);
  for (let frameIndex = 0; frameIndex < RUNNER_SPRITE_SHEET.frameCount; frameIndex += 1) {
    const frameName = String(frameIndex);
    if (!texture.has(frameName)) return false;
    const frame = texture.get(frameName);
    if (
      frame.cutWidth !== RUNNER_SPRITE_SHEET.frameWidth ||
      frame.cutHeight !== RUNNER_SPRITE_SHEET.frameHeight
    ) {
      return false;
    }
  }
  return true;
}

function registerRunnerFrames(scene: Phaser.Scene, textureKey: string): boolean {
  const texture = scene.textures.get(textureKey);
  for (let frameIndex = 0; frameIndex < RUNNER_SPRITE_SHEET.frameCount; frameIndex += 1) {
    const column = frameIndex % RUNNER_SPRITE_SHEET.columns;
    const row = Math.floor(frameIndex / RUNNER_SPRITE_SHEET.columns);
    texture.add(
      String(frameIndex),
      0,
      column * RUNNER_SPRITE_SHEET.frameWidth,
      row * RUNNER_SPRITE_SHEET.frameHeight,
      RUNNER_SPRITE_SHEET.frameWidth,
      RUNNER_SPRITE_SHEET.frameHeight,
    );
  }
  return hasCompleteRunnerSheet(scene, textureKey);
}

/**
 * Prefer a future authored sprite sheet when it is preloaded under the public
 * contract key. Until then, bake the original vector frames into one atlas at
 * runtime. This keeps rendering fast while preserving a deterministic fallback.
 */
function ensureRunnerSheet(scene: Phaser.Scene): string | null {
  if (hasCompleteRunnerSheet(scene, RUNNER_SPRITE_SHEET.textureKey)) {
    return RUNNER_SPRITE_SHEET.textureKey;
  }
  if (hasCompleteRunnerSheet(scene, GENERATED_SHEET_KEY)) return GENERATED_SHEET_KEY;
  if (scene.textures.exists(GENERATED_SHEET_KEY)) return null;

  const graphics = new Phaser.GameObjects.Graphics(scene);
  try {
    drawRunnerSpriteSheet(graphics);
    graphics.generateTexture(
      GENERATED_SHEET_KEY,
      RUNNER_SPRITE_SHEET.frameWidth * RUNNER_SPRITE_SHEET.columns,
      RUNNER_SPRITE_SHEET.frameHeight * RUNNER_SPRITE_SHEET.rows,
    );
    return registerRunnerFrames(scene, GENERATED_SHEET_KEY) ? GENERATED_SHEET_KEY : null;
  } catch {
    return null;
  } finally {
    graphics.destroy();
  }
}

/**
 * Physics-owning runner container. Visual frames are isolated behind a stable
 * 58 × 86 Arcade body, so art can be replaced without changing jump timing,
 * collision fairness or player controls.
 */
export class Player extends Phaser.GameObjects.Container {
  private readonly fallbackVisual: Phaser.GameObjects.Graphics;
  private readonly frameSprite?: Phaser.GameObjects.Image;
  private runnerState: RunnerState = 'idle';
  private previousState: RunnerState = 'idle';
  private animationClockMs = 0;
  private animationPaused = false;
  private currentAirPhase: RunnerAirPhase = 'takeoff';
  private airPhaseElapsedMs = 0;
  private currentFrameIndex = -1;
  private hurtTimer?: Phaser.Time.TimerEvent;

  declare public body: Phaser.Physics.Arcade.Body;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    gravityY: number,
    width: number,
    height: number,
  ) {
    super(scene, x, y);

    this.fallbackVisual = scene.add.graphics();
    this.add(this.fallbackVisual);
    this.setSize(width, height);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(width, height);
    this.body.setGravityY(gravityY);
    this.body.setCollideWorldBounds(true);

    const sheetKey = ensureRunnerSheet(scene);
    if (sheetKey) {
      const physicalOriginY =
        RUNNER_SPRITE_SHEET.footBaselineY -
        RUNNER_SPRITE_SHEET.localFootBaselineY / RUNNER_SPRITE_SHEET.displayScale;
      this.frameSprite = scene.add
        .image(0, 0, sheetKey, String(RUNNER_ANIMATION_SPECS.idle.frames[0]))
        .setOrigin(
          RUNNER_SPRITE_SHEET.anchorX / RUNNER_SPRITE_SHEET.frameWidth,
          physicalOriginY / RUNNER_SPRITE_SHEET.frameHeight,
        )
        .setScale(RUNNER_SPRITE_SHEET.displayScale);
      this.addAt(this.frameSprite, 0);
      this.fallbackVisual.setVisible(false);
    }

    this.applyAnimationFrame(true);
  }

  public setRunnerState(state: RunnerState): void {
    if (this.runnerState === state) return;

    this.runnerState = state;
    this.animationClockMs = 0;
    this.currentAirPhase = 'takeoff';
    this.airPhaseElapsedMs = 0;
    this.applyAnimationFrame(true);
  }

  public getRunnerState(): RunnerState {
    return this.runnerState;
  }

  public getAnimationFrameIndex(): number {
    return this.currentFrameIndex;
  }

  public setAnimationPaused(paused: boolean): void {
    this.animationPaused = paused;
  }

  public isAnimationPaused(): boolean {
    return this.animationPaused;
  }

  public jump(velocity: number): boolean {
    const onGround = this.body.blocked.down || this.body.touching.down;
    if (
      !onGround ||
      this.runnerState === 'hurt' ||
      this.runnerState === 'finished' ||
      this.runnerState === 'gameOver'
    ) {
      return false;
    }

    this.body.setVelocityY(-velocity);
    this.setRunnerState('jumping');
    return true;
  }

  public showHurt(durationMs: number): void {
    if (this.runnerState === 'finished' || this.runnerState === 'gameOver') return;

    const isGrounded = this.body.blocked.down || this.body.touching.down;
    this.previousState = isGrounded ? 'running' : 'jumping';
    this.hurtTimer?.remove(false);
    this.setRunnerState('hurt');

    this.hurtTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.runnerState !== 'hurt') return;

      const nextState =
        this.body.blocked.down || this.body.touching.down ? 'running' : this.previousState;
      this.setRunnerState(nextState);
      this.animationClockMs = getRunnerResumeAnimationElapsed(nextState);
      this.applyAnimationFrame(true);
    });
  }

  public updateRunner(deltaMs: number, isRunning: boolean): void {
    if (this.animationPaused) return;

    const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    if (
      isRunning &&
      this.runnerState !== 'hurt' &&
      this.runnerState !== 'finished' &&
      this.runnerState !== 'gameOver'
    ) {
      const nextState = this.body.blocked.down ? 'running' : 'jumping';
      if (this.runnerState !== nextState) this.setRunnerState(nextState);
    }

    const shouldAnimate =
      isRunning ||
      this.runnerState === 'idle' ||
      this.runnerState === 'finished' ||
      this.runnerState === 'gameOver';
    if (!shouldAnimate) return;

    this.animationClockMs += safeDeltaMs;
    this.applyAnimationFrame(false, safeDeltaMs);
  }

  public markGameOver(): void {
    this.hurtTimer?.remove(false);
    this.body.setVelocity(0, 0);
    this.body.setAcceleration(0, 0);
    this.setRunnerState('gameOver');
  }

  public markFinished(): void {
    this.hurtTimer?.remove(false);
    this.body.setVelocity(0, 0);
    this.body.setAcceleration(0, 0);
    this.setRunnerState('finished');
  }

  private applyAnimationFrame(force: boolean, deltaMs = 0): void {
    let frameIndex: number;
    if (this.runnerState === 'jumping') {
      const nextAirPhase = getRunnerAirPhase(this.body.velocity.y, this.animationClockMs);
      if (nextAirPhase !== this.currentAirPhase) {
        this.currentAirPhase = nextAirPhase;
        this.airPhaseElapsedMs = 0;
      } else {
        this.airPhaseElapsedMs += deltaMs;
      }
      frameIndex = getRunnerJumpFrame(this.currentAirPhase, this.airPhaseElapsedMs);
    } else {
      frameIndex = getRunnerAnimationFrame(this.runnerState, this.animationClockMs);
    }

    if (!force && frameIndex === this.currentFrameIndex) return;
    this.currentFrameIndex = frameIndex;

    if (this.frameSprite) {
      this.frameSprite.setFrame(String(frameIndex));
      return;
    }

    this.fallbackVisual.clear();
    drawRunnerFrame(this.fallbackVisual, frameIndex);
  }
}
