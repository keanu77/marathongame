import Phaser from 'phaser';

export type RunnerState = 'idle' | 'running' | 'jumping' | 'hurt' | 'finished' | 'gameOver';

export type RunnerAirPhase = 'takeoff' | 'ascent' | 'apex' | 'descent';

export const RUNNER_ANIMATION_TIMING = {
  runCycleMs: 660,
  takeoffExtensionMs: 45,
  landingCompressionMs: 120,
} as const;

const RUNNER_PALETTE = {
  outline: 0x17324d,
  skin: 0xffd3a7,
  skinHighlight: 0xffe1bd,
  skinShadow: 0xe7a26a,
  singlet: 0x159d91,
  singletHighlight: 0x73d5c8,
  identityBand: 0xff9f43,
  identityBandLight: 0xffc857,
  shorts: 0x17324d,
  shortsPanel: 0x315a78,
  socks: 0xf7fbff,
  shoeUpper: 0xf16f5c,
  shoeAccent: 0xffc857,
  shoeMidsole: 0xffffff,
  shoeOutsole: 0x243447,
  cap: 0x17324d,
  capHighlight: 0x315a78,
  hurt: 0xe5484d,
} as const;

const SHOE_CONTACT_Y = 39;
const HIP_Y = 12;
const RUNNING_SHOULDER_OFFSET_X = 4;
const AIRBORNE_VELOCITY_THRESHOLD = 160;

interface RunningLegPose {
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
  isSupport: boolean;
}

interface RunningArmPose {
  elbowX: number;
  elbowY: number;
  handX: number;
  handY: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** A same-leg cycle of 660 ms produces a natural distance-running cadence near 182 spm. */
export function getRunnerRunCyclePhase(timeMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  return (timeMs % RUNNER_ANIMATION_TIMING.runCycleMs) / RUNNER_ANIMATION_TIMING.runCycleMs;
}

/** Resolve a readable airborne silhouette without coupling the renderer to scene rules. */
export function getRunnerAirPhase(velocityY: number, stateElapsedMs: number): RunnerAirPhase {
  const elapsedMs = Number.isFinite(stateElapsedMs) ? Math.max(0, stateElapsedMs) : 0;
  const safeVelocityY = Number.isFinite(velocityY) ? velocityY : 0;
  if (safeVelocityY > AIRBORNE_VELOCITY_THRESHOLD) return 'descent';
  if (safeVelocityY >= -AIRBORNE_VELOCITY_THRESHOLD) return 'apex';
  if (elapsedMs < RUNNER_ANIMATION_TIMING.takeoffExtensionMs) return 'takeoff';
  return 'ascent';
}

export function getRunnerLandingCompression(remainingMs: number): number {
  if (!Number.isFinite(remainingMs)) return 0;
  return clamp(remainingMs / RUNNER_ANIMATION_TIMING.landingCompressionMs, 0, 1);
}

export function getRunnerResumeAnimationElapsed(state: RunnerState): number {
  return state === 'jumping' ? RUNNER_ANIMATION_TIMING.takeoffExtensionMs : 0;
}

function createLegPose(): RunningLegPose {
  return {
    kneeX: 0,
    kneeY: 25,
    footX: 0,
    footY: SHOE_CONTACT_Y,
    isSupport: true,
  };
}

function createArmPose(): RunningArmPose {
  return { elbowX: 0, elbowY: -4, handX: 0, handY: 8 };
}

/**
 * Code-native runner renderer with a stable gameplay boundary. The visual
 * implementation is isolated here so production vector art can later be
 * replaced by an atlas or sprite sheet without changing controls or physics.
 */
export class Player extends Phaser.GameObjects.Container {
  private readonly visual: Phaser.GameObjects.Graphics;
  private readonly farLegPose = createLegPose();
  private readonly nearLegPose = createLegPose();
  private readonly farArmPose = createArmPose();
  private readonly nearArmPose = createArmPose();
  private runnerState: RunnerState = 'idle';
  private previousState: RunnerState = 'idle';
  private animationClock = 0;
  private landingCompressionRemainingMs = 0;
  private jumpUpperBodyOffsetY = 0;
  private jumpUpperBodyLean = 0;
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

    this.visual = scene.add.graphics();
    this.add(this.visual);
    this.setSize(width, height);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(width, height);
    this.body.setGravityY(gravityY);
    this.body.setCollideWorldBounds(true);

    this.drawRunner(0);
  }

  public setRunnerState(state: RunnerState): void {
    if (this.runnerState === state) return;

    this.runnerState = state;
    this.animationClock = 0;
    if (state !== 'running') this.landingCompressionRemainingMs = 0;
    this.drawRunner(0);
  }

  public getRunnerState(): RunnerState {
    return this.runnerState;
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

    this.previousState = this.body.blocked.down ? 'running' : 'jumping';
    this.hurtTimer?.remove(false);
    this.setRunnerState('hurt');

    this.hurtTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.runnerState === 'hurt') {
        const nextState = this.body.blocked.down ? 'running' : this.previousState;
        this.setRunnerState(nextState);
        this.animationClock = getRunnerResumeAnimationElapsed(nextState);
        this.drawRunner(this.animationClock);
      }
    });
  }

  public updateRunner(deltaMs: number, isRunning: boolean): void {
    const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.animationClock += safeDeltaMs;

    if (
      isRunning &&
      this.runnerState !== 'hurt' &&
      this.runnerState !== 'finished' &&
      this.runnerState !== 'gameOver'
    ) {
      const nextState = this.body.blocked.down ? 'running' : 'jumping';
      if (this.runnerState !== nextState) {
        if (this.runnerState === 'jumping' && nextState === 'running') {
          this.landingCompressionRemainingMs = RUNNER_ANIMATION_TIMING.landingCompressionMs;
        }
        this.setRunnerState(nextState);
      }
    }

    if (
      isRunning &&
      (this.runnerState === 'running' ||
        this.runnerState === 'jumping' ||
        this.runnerState === 'hurt')
    ) {
      this.drawRunner(this.animationClock);
    }

    if (this.runnerState === 'running' && this.landingCompressionRemainingMs > 0) {
      this.landingCompressionRemainingMs = Math.max(
        0,
        this.landingCompressionRemainingMs - safeDeltaMs,
      );
    }
  }

  public markGameOver(): void {
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

  private drawRunner(timeMs: number): void {
    const graphics = this.visual;
    const isRunning = this.runnerState === 'running';
    const isJumping = this.runnerState === 'jumping';
    const isHurt = this.runnerState === 'hurt';
    const isFinished = this.runnerState === 'finished';
    const isGameOver = this.runnerState === 'gameOver';
    const gaitCycle = getRunnerRunCyclePhase(timeMs);
    const gaitWave = Math.cos(gaitCycle * Math.PI * 2);
    const landingCompression = isRunning
      ? getRunnerLandingCompression(this.landingCompressionRemainingMs)
      : 0;
    const airPhase = isJumping ? getRunnerAirPhase(this.body.velocity.y, timeMs) : undefined;

    let upperBodyOffsetY = 0;
    let upperBodyLean = 0;
    let wholeBodyLean = 0;
    let farShoulderX = -10;
    let nearShoulderX = 10;

    this.setLegPose(this.farLegPose, -8, 25, -14, SHOE_CONTACT_Y, true);
    this.setLegPose(this.nearLegPose, 8, 25, 14, SHOE_CONTACT_Y, true);
    this.setArmPose(this.farArmPose, -14, -5, -18, 10);
    this.setArmPose(this.nearArmPose, 14, -5, 18, 9);

    if (isRunning && landingCompression === 0) {
      this.getRunningLegPose(gaitCycle, this.farLegPose);
      this.getRunningLegPose(gaitCycle + 0.5, this.nearLegPose);
      farShoulderX = -RUNNING_SHOULDER_OFFSET_X;
      nearShoulderX = RUNNING_SHOULDER_OFFSET_X;
      this.getRunningArmPose(-1, -gaitWave, this.farArmPose);
      this.getRunningArmPose(1, gaitWave, this.nearArmPose);
      upperBodyOffsetY = -Math.abs(Math.sin(gaitCycle * Math.PI * 2)) * 1.6;
      upperBodyLean = 0.095;
    } else if (isRunning) {
      const compression = this.smoothStep(landingCompression);
      this.setLegPose(this.farLegPose, -10, 28 + compression * 2, -15, SHOE_CONTACT_Y, true);
      this.setLegPose(this.nearLegPose, 10, 29 + compression * 2, 15, SHOE_CONTACT_Y, true);
      this.setArmPose(this.farArmPose, -15, -3, -21, 8);
      this.setArmPose(this.nearArmPose, 16, -5, 22, 3);
      upperBodyOffsetY = compression * 4;
      upperBodyLean = 0.06;
    } else if (isJumping) {
      this.setJumpPose(airPhase);
      upperBodyOffsetY = this.jumpUpperBodyOffsetY;
      upperBodyLean = this.jumpUpperBodyLean;
      farShoulderX = -RUNNING_SHOULDER_OFFSET_X;
      nearShoulderX = RUNNING_SHOULDER_OFFSET_X;
    } else if (isHurt) {
      this.setLegPose(this.farLegPose, -10, 26, -18, SHOE_CONTACT_Y, true);
      this.setLegPose(this.nearLegPose, 9, 25, 11, SHOE_CONTACT_Y - 2, false);
      this.setArmPose(this.farArmPose, -18, -7, -24, 3);
      this.setArmPose(this.nearArmPose, 14, -7, 5, -4);
      wholeBodyLean = -0.12;
      upperBodyOffsetY = 1;
    } else if (isFinished) {
      this.setLegPose(this.farLegPose, -8, 25, -13, SHOE_CONTACT_Y, true);
      this.setLegPose(this.nearLegPose, 8, 25, 13, SHOE_CONTACT_Y, true);
      this.setArmPose(this.farArmPose, -17, -31, -23, -49);
      this.setArmPose(this.nearArmPose, 17, -31, 23, -49);
    } else if (isGameOver) {
      this.setLegPose(this.farLegPose, -7, 28, -11, SHOE_CONTACT_Y, true);
      this.setLegPose(this.nearLegPose, 9, 29, 15, SHOE_CONTACT_Y, true);
      this.setArmPose(this.farArmPose, -7, 0, -2, 15);
      this.setArmPose(this.nearArmPose, 11, 1, 15, 16);
      wholeBodyLean = 0.34;
      upperBodyOffsetY = 3;
    }

    const hurtShakeX = isHurt ? Math.sin(timeMs * 0.075) * 1.7 : 0;

    graphics.clear();
    graphics.setPosition(0, 0);
    graphics.save();
    graphics.translateCanvas(hurtShakeX, 0);
    if (wholeBodyLean !== 0) graphics.rotateCanvas(wholeBodyLean);

    // The far leg establishes depth; the near leg stays crisp over it.
    this.drawLeg(graphics, -6, this.farLegPose, false);
    this.drawLeg(graphics, 6, this.nearLegPose, true);

    graphics.save();
    graphics.translateCanvas(0, upperBodyOffsetY);
    if (upperBodyLean !== 0) graphics.rotateCanvas(upperBodyLean);

    this.drawArm(graphics, farShoulderX, this.farArmPose, false);
    this.drawTorso(graphics, isFinished);
    this.drawArm(graphics, nearShoulderX, this.nearArmPose, true);
    this.drawHead(graphics, isHurt, isFinished, isGameOver);

    if (isHurt) this.drawHurtAccent(graphics);
    if (isFinished) this.drawFinishAccent(graphics);
    if (isGameOver) this.drawFatigueAccent(graphics);

    graphics.restore();
    graphics.restore();
  }

  private setJumpPose(airPhase: RunnerAirPhase | undefined): void {
    if (airPhase === 'takeoff') {
      // Physics has already left the ground, so this is a brief toe-off
      // extension rather than a crouch that would visually lag behind the body.
      this.setLegPose(this.farLegPose, -7, 23, -17, 38, false);
      this.setLegPose(this.nearLegPose, 11, 17, 1, 29, false);
      this.setArmPose(this.farArmPose, -13, -2, -18, 9);
      this.setArmPose(this.nearArmPose, 14, -10, 21, -18);
      this.jumpUpperBodyOffsetY = -1;
      this.jumpUpperBodyLean = 0.12;
      return;
    }

    if (airPhase === 'ascent') {
      this.setLegPose(this.farLegPose, -7, 24, -19, 33, false);
      this.setLegPose(this.nearLegPose, 12, 15, 2, 29, false);
      this.setArmPose(this.farArmPose, -13, -2, -18, 9);
      this.setArmPose(this.nearArmPose, 14, -11, 21, -19);
      this.jumpUpperBodyOffsetY = -1;
      this.jumpUpperBodyLean = 0.08;
      return;
    }

    if (airPhase === 'descent') {
      this.setLegPose(this.farLegPose, -8, 23, -15, 32, false);
      this.setLegPose(this.nearLegPose, 9, 23, 20, 38, false);
      this.setArmPose(this.farArmPose, -19, -9, -27, -2);
      this.setArmPose(this.nearArmPose, 19, -9, 27, -2);
      this.jumpUpperBodyOffsetY = 0;
      this.jumpUpperBodyLean = 0.025;
      return;
    }

    this.setLegPose(this.farLegPose, -10, 18, -4, 30, false);
    this.setLegPose(this.nearLegPose, 11, 18, 5, 30, false);
    this.setArmPose(this.farArmPose, -18, -12, -27, -6);
    this.setArmPose(this.nearArmPose, 18, -12, 27, -6);
    this.jumpUpperBodyOffsetY = -2;
    this.jumpUpperBodyLean = 0.05;
  }

  private getRunningLegPose(rawPhase: number, output: RunningLegPose): void {
    const phase = ((rawPhase % 1) + 1) % 1;
    const stanceRatio = 0.46;

    if (phase < stanceRatio) {
      const progress = this.smoothStep(phase / stanceRatio);
      const compression = Math.sin(progress * Math.PI);
      output.kneeX = this.lerp(6, -7, progress) + compression * 2;
      output.kneeY = 23 + compression * 2.8;
      output.footX = this.lerp(17, -15, progress);
      output.footY = SHOE_CONTACT_Y;
      output.isSupport = true;
      return;
    }

    const progress = this.smoothStep((phase - stanceRatio) / (1 - stanceRatio));
    output.kneeX = this.quadraticBezier(-7, 12, 6, progress);
    output.kneeY = this.quadraticBezier(25, 15, 22, progress);
    output.footX = this.quadraticBezier(-15, -7, 17, progress);
    output.footY = this.quadraticBezier(SHOE_CONTACT_Y, 23, SHOE_CONTACT_Y - 1, progress);
    output.isSupport = false;
  }

  private getRunningArmPose(side: -1 | 1, swing: number, output: RunningArmPose): void {
    const shoulderX = side * RUNNING_SHOULDER_OFFSET_X;
    const forwardProgress = this.smoothStep((swing + 1) / 2);

    output.elbowX = this.lerp(shoulderX - 12, shoulderX + 10, forwardProgress);
    output.elbowY = this.lerp(-3, -4, forwardProgress);
    output.handX = this.lerp(shoulderX - 5, shoulderX + 18, forwardProgress);
    output.handY = this.lerp(9, -12, forwardProgress);
  }

  private drawTorso(graphics: Phaser.GameObjects.Graphics, withMedal: boolean): void {
    graphics.lineStyle(2, RUNNER_PALETTE.outline, 0.3);
    graphics.fillStyle(RUNNER_PALETTE.singlet, 1);
    graphics.fillRoundedRect(-14, -25, 28, 35, 7);
    graphics.strokeRoundedRect(-14, -25, 28, 35, 7);

    graphics.fillStyle(RUNNER_PALETTE.singletHighlight, 1);
    graphics.fillRoundedRect(-13, -22, 4, 26, 2);

    // A bold orange band is the original runner's visual signature, not a logo.
    graphics.fillStyle(RUNNER_PALETTE.identityBand, 1);
    graphics.fillRoundedRect(-13, -11, 26, 7, 2);
    graphics.fillStyle(RUNNER_PALETTE.identityBandLight, 0.8);
    graphics.fillRoundedRect(-11, -10, 9, 2, 1);

    graphics.fillStyle(RUNNER_PALETTE.skin, 1);
    graphics.fillRoundedRect(-4, -28, 8, 10, 4);
    graphics.fillCircle(0, -21, 5.5);

    graphics.fillStyle(RUNNER_PALETTE.shorts, 1);
    graphics.fillRoundedRect(-15, 4, 14, 18, 4);
    graphics.fillRoundedRect(1, 4, 14, 18, 4);
    graphics.fillRect(-14, 4, 28, 7);
    graphics.fillStyle(RUNNER_PALETTE.shortsPanel, 1);
    graphics.fillRect(-13, 8, 3, 10);
    graphics.fillRect(10, 8, 3, 10);
    graphics.lineStyle(1.5, RUNNER_PALETTE.identityBand, 0.9);
    graphics.beginPath();
    graphics.moveTo(-10, 9);
    graphics.lineTo(-10, 17);
    graphics.moveTo(10, 9);
    graphics.lineTo(10, 17);
    graphics.strokePath();

    if (withMedal) {
      graphics.lineStyle(2, RUNNER_PALETTE.identityBand, 1);
      graphics.beginPath();
      graphics.moveTo(-5, -12);
      graphics.lineTo(0, -5);
      graphics.lineTo(5, -12);
      graphics.strokePath();
      graphics.fillStyle(RUNNER_PALETTE.identityBandLight, 1);
      graphics.fillCircle(0, -3, 4.2);
      graphics.lineStyle(1.3, RUNNER_PALETTE.outline, 0.65);
      graphics.strokeCircle(0, -3, 4.2);
    }
  }

  private drawHead(
    graphics: Phaser.GameObjects.Graphics,
    isHurt: boolean,
    isFinished: boolean,
    isGameOver: boolean,
  ): void {
    graphics.fillStyle(RUNNER_PALETTE.skin, 1);
    graphics.fillCircle(1, -39, 13);
    graphics.fillTriangle(11, -42, 16, -39, 11, -36);
    graphics.fillStyle(RUNNER_PALETTE.skinShadow, 1);
    graphics.fillCircle(-10, -39, 3);

    // Deep-blue running cap with the same orange identity accent as the singlet.
    graphics.fillStyle(RUNNER_PALETTE.cap, 1);
    graphics.fillRoundedRect(-12, -52, 25, 9, 4);
    graphics.fillStyle(RUNNER_PALETTE.capHighlight, 1);
    graphics.fillRoundedRect(-8, -51, 17, 3, 1.5);
    graphics.fillStyle(RUNNER_PALETTE.identityBand, 1);
    graphics.fillRect(-11, -45, 23, 2.5);
    graphics.fillStyle(RUNNER_PALETTE.cap, 1);
    graphics.fillRoundedRect(9, -45, 13, 3.5, 1.5);

    graphics.fillStyle(RUNNER_PALETTE.outline, 1);
    if (isGameOver) {
      graphics.lineStyle(2, RUNNER_PALETTE.outline, 1);
      graphics.beginPath();
      graphics.moveTo(4, -42);
      graphics.lineTo(9, -38);
      graphics.moveTo(9, -42);
      graphics.lineTo(4, -38);
      graphics.strokePath();
    } else {
      graphics.fillCircle(7, -41, isHurt ? 2 : 1.5);
    }

    graphics.lineStyle(1.8, RUNNER_PALETTE.outline, 0.9);
    graphics.beginPath();
    if (isFinished) {
      graphics.moveTo(3, -34);
      graphics.lineTo(7, -31.5);
      graphics.lineTo(11, -35);
    } else if (isHurt || isGameOver) {
      graphics.moveTo(4, -33);
      graphics.lineTo(7, -36);
      graphics.lineTo(10, -34);
    } else {
      graphics.moveTo(5, -34);
      graphics.lineTo(9, -34);
    }
    graphics.strokePath();
  }

  private drawArm(
    graphics: Phaser.GameObjects.Graphics,
    shoulderX: number,
    pose: RunningArmPose,
    isNear: boolean,
  ): void {
    const color = isNear ? RUNNER_PALETTE.skin : RUNNER_PALETTE.skinShadow;
    const width = isNear ? 7.5 : 6.5;

    graphics.lineStyle(width + 2, RUNNER_PALETTE.outline, isNear ? 0.18 : 0.11);
    graphics.beginPath();
    graphics.moveTo(shoulderX, -16);
    graphics.lineTo(pose.elbowX, pose.elbowY);
    graphics.lineTo(pose.handX, pose.handY);
    graphics.strokePath();

    graphics.lineStyle(width, color, 1);
    graphics.beginPath();
    graphics.moveTo(shoulderX, -16);
    graphics.lineTo(pose.elbowX, pose.elbowY);
    graphics.lineTo(pose.handX, pose.handY);
    graphics.strokePath();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(pose.elbowX, pose.elbowY, width * 0.48);
    graphics.fillCircle(pose.handX, pose.handY, isNear ? 4.4 : 4);
    graphics.fillStyle(isNear ? RUNNER_PALETTE.skinHighlight : color, 0.8);
    graphics.fillCircle(pose.handX + 1, pose.handY - 1, 1.2);
  }

  private drawLeg(
    graphics: Phaser.GameObjects.Graphics,
    hipX: number,
    pose: RunningLegPose,
    isNear: boolean,
  ): void {
    const skinColor = isNear ? RUNNER_PALETTE.skin : RUNNER_PALETTE.skinShadow;
    const opacity = isNear ? 1 : 0.88;

    graphics.lineStyle(isNear ? 10 : 9, RUNNER_PALETTE.shorts, opacity);
    graphics.beginPath();
    graphics.moveTo(hipX, HIP_Y);
    graphics.lineTo(pose.kneeX, pose.kneeY);
    graphics.strokePath();

    graphics.lineStyle(isNear ? 7.5 : 6.5, skinColor, opacity);
    graphics.beginPath();
    graphics.moveTo(pose.kneeX, pose.kneeY);
    graphics.lineTo(pose.footX, pose.footY - 4);
    graphics.strokePath();
    graphics.fillStyle(skinColor, opacity);
    graphics.fillCircle(pose.kneeX, pose.kneeY, isNear ? 4.3 : 3.8);

    this.drawSock(graphics, pose.kneeX, pose.kneeY, pose.footX, pose.footY, opacity);
    this.drawRunningShoe(graphics, pose.footX, pose.footY, opacity);
  }

  private drawSock(
    graphics: Phaser.GameObjects.Graphics,
    kneeX: number,
    kneeY: number,
    footX: number,
    footY: number,
    opacity: number,
  ): void {
    const sockX = kneeX + (footX - kneeX) * 0.7;
    const sockY = kneeY + (footY - kneeY) * 0.7;
    graphics.lineStyle(7, RUNNER_PALETTE.socks, opacity);
    graphics.beginPath();
    graphics.moveTo(sockX, sockY);
    graphics.lineTo(footX, footY - 3);
    graphics.strokePath();
    graphics.lineStyle(2, RUNNER_PALETTE.singlet, opacity * 0.85);
    graphics.beginPath();
    graphics.moveTo(sockX - 3, sockY);
    graphics.lineTo(sockX + 3, sockY);
    graphics.strokePath();
  }

  private drawRunningShoe(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    opacity: number,
  ): void {
    const heelX = x - 6;
    const toeX = x + 11;
    const left = heelX - 1;
    const width = toeX - heelX + 2;

    graphics.fillStyle(RUNNER_PALETTE.shoeOutsole, opacity);
    graphics.fillRoundedRect(left, y, width, 5, 2.5);
    graphics.fillStyle(RUNNER_PALETTE.shoeMidsole, opacity);
    graphics.fillRoundedRect(left, y - 2, width, 4, 2);
    graphics.fillStyle(RUNNER_PALETTE.shoeUpper, opacity);
    graphics.beginPath();
    graphics.moveTo(heelX, y - 2);
    graphics.lineTo(heelX, y - 8);
    graphics.lineTo(x + 2, y - 7);
    graphics.lineTo(toeX, y - 2);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(RUNNER_PALETTE.shoeAccent, opacity);
    graphics.fillCircle(x + 2, y - 4, 2);
    graphics.lineStyle(1.5, 0xffffff, opacity * 0.95);
    graphics.beginPath();
    graphics.moveTo(x - 2, y - 6);
    graphics.lineTo(x + 6, y - 4);
    graphics.strokePath();
  }

  private drawHurtAccent(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, RUNNER_PALETTE.hurt, 1);
    graphics.beginPath();
    graphics.moveTo(18, -38);
    graphics.lineTo(25, -46);
    graphics.moveTo(21, -31);
    graphics.lineTo(31, -31);
    graphics.moveTo(19, -35);
    graphics.lineTo(27, -38);
    graphics.strokePath();
  }

  private drawFinishAccent(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, RUNNER_PALETTE.identityBandLight, 1);
    graphics.beginPath();
    graphics.moveTo(-28, -45);
    graphics.lineTo(-34, -51);
    graphics.moveTo(-29, -37);
    graphics.lineTo(-37, -37);
    graphics.moveTo(28, -45);
    graphics.lineTo(34, -51);
    graphics.moveTo(29, -37);
    graphics.lineTo(37, -37);
    graphics.strokePath();
  }

  private drawFatigueAccent(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x78c7e8, 0.9);
    graphics.fillCircle(18, -31, 2.6);
    graphics.fillTriangle(15.5, -31, 20.5, -31, 18, -37);
  }

  private setLegPose(
    pose: RunningLegPose,
    kneeX: number,
    kneeY: number,
    footX: number,
    footY: number,
    isSupport: boolean,
  ): void {
    pose.kneeX = kneeX;
    pose.kneeY = kneeY;
    pose.footX = footX;
    pose.footY = footY;
    pose.isSupport = isSupport;
  }

  private setArmPose(
    pose: RunningArmPose,
    elbowX: number,
    elbowY: number,
    handX: number,
    handY: number,
  ): void {
    pose.elbowX = elbowX;
    pose.elbowY = elbowY;
    pose.handX = handX;
    pose.handY = handY;
  }

  private lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
  }

  private smoothStep(value: number): number {
    const clamped = clamp(value, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
  }

  private quadraticBezier(start: number, control: number, end: number, amount: number): number {
    const inverse = 1 - amount;
    return inverse * inverse * start + 2 * inverse * amount * control + amount * amount * end;
  }
}
