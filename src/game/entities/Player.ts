import Phaser from 'phaser';

export type RunnerState = 'idle' | 'running' | 'jumping' | 'hurt' | 'finished' | 'gameOver';

const RUNNER_PALETTE = {
  skin: 0xffd3a7,
  skinShadow: 0xe9a86d,
  singlet: 0x159d91,
  singletPanel: 0x73d5c8,
  shorts: 0x17324d,
  shortsPanel: 0x315a78,
  socks: 0xf7fbff,
  shoeUpper: 0xf16f5c,
  shoeAccent: 0xffc857,
  shoeMidsole: 0xffffff,
  shoeOutsole: 0x243447,
  hair: 0x17324d,
  hurt: 0xe5484d,
} as const;

const RUN_CYCLE_MS = 720;
const SHOE_CONTACT_Y = 38;
const RUNNING_SHOULDER_OFFSET_X = 4;

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

/**
 * Geometric placeholder renderer for the runner.  The scene talks only to this
 * class, so a future sprite-sheet implementation can replace drawRunner()
 * without changing controls, collisions, or game rules.
 */
export class Player extends Phaser.GameObjects.Container {
  private readonly visual: Phaser.GameObjects.Graphics;
  private runnerState: RunnerState = 'idle';
  private previousState: RunnerState = 'idle';
  private animationClock = 0;
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
        this.setRunnerState(this.body.blocked.down ? 'running' : this.previousState);
      }
    });
  }

  public updateRunner(deltaMs: number, isRunning: boolean): void {
    this.animationClock += deltaMs;

    if (
      isRunning &&
      this.runnerState !== 'hurt' &&
      this.runnerState !== 'finished' &&
      this.runnerState !== 'gameOver'
    ) {
      const nextState = this.body.blocked.down ? 'running' : 'jumping';
      if (this.runnerState !== nextState) this.setRunnerState(nextState);
    }

    if (isRunning && this.runnerState === 'running') {
      this.drawRunner(this.animationClock);
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
    const gaitCycle = (timeMs % RUN_CYCLE_MS) / RUN_CYCLE_MS;
    const gaitWave = Math.cos(gaitCycle * Math.PI * 2);
    const lean = isHurt ? -0.18 : isGameOver ? 0.75 : isRunning ? 0.11 : 0;
    const torsoBobY = isRunning ? -Math.abs(Math.sin(gaitCycle * Math.PI * 2)) * 2.2 : 0;

    let leftKneeX = -8;
    let leftKneeY = 25;
    let leftFootX = -14;
    let leftFootY = SHOE_CONTACT_Y;
    let leftIsSupport = true;
    let rightKneeX = 8;
    let rightKneeY = 25;
    let rightFootX = 14;
    let rightFootY = SHOE_CONTACT_Y;
    let rightIsSupport = true;

    if (isRunning) {
      const leftLeg = this.getRunningLegPose(gaitCycle);
      const rightLeg = this.getRunningLegPose(gaitCycle + 0.5);
      ({
        kneeX: leftKneeX,
        kneeY: leftKneeY,
        footX: leftFootX,
        footY: leftFootY,
        isSupport: leftIsSupport,
      } = leftLeg);
      ({
        kneeX: rightKneeX,
        kneeY: rightKneeY,
        footX: rightFootX,
        footY: rightFootY,
        isSupport: rightIsSupport,
      } = rightLeg);
    }

    if (isJumping) {
      leftFootX = -2;
      leftFootY = 34;
      leftKneeX = -11;
      leftKneeY = 20;
      leftIsSupport = false;
      rightFootX = 19;
      rightFootY = 31;
      rightKneeX = 12;
      rightKneeY = 18;
      rightIsSupport = false;
    } else if (isHurt) {
      leftFootX = -17;
      leftFootY = SHOE_CONTACT_Y;
      leftKneeX = -10;
      leftKneeY = 25;
      rightFootX = 10;
      rightFootY = SHOE_CONTACT_Y - 2;
      rightKneeX = 9;
      rightKneeY = 24;
    } else if (isFinished) {
      leftFootX = -13;
      leftFootY = SHOE_CONTACT_Y;
      leftKneeX = -8;
      leftKneeY = 25;
      rightFootX = 13;
      rightFootY = SHOE_CONTACT_Y;
      rightKneeX = 8;
      rightKneeY = 25;
    }

    graphics.clear();
    graphics.setPosition(0, 0);
    graphics.save();
    if (!isRunning) graphics.rotateCanvas(lean);

    // The far leg is rendered first. Stance legs stay long and grounded while
    // recovery legs fold at the knee and visibly lift the shoe off the road.
    this.drawLeg(graphics, -6, {
      kneeX: leftKneeX,
      kneeY: leftKneeY,
      footX: leftFootX,
      footY: leftFootY,
      isSupport: leftIsSupport,
    });
    this.drawLeg(graphics, 6, {
      kneeX: rightKneeX,
      kneeY: rightKneeY,
      footX: rightFootX,
      footY: rightFootY,
      isSupport: rightIsSupport,
    });

    // Bob and forward lean apply only to the upper-body drawing commands.
    // The support shoe, Container position, and Arcade body never move with it.
    if (isRunning) {
      graphics.translateCanvas(0, torsoBobY);
      graphics.rotateCanvas(lean);
    }

    let leftElbowX = -14;
    let leftElbowY = -5;
    let leftHandX = -19;
    let leftHandY = 10;
    let rightElbowX = 14;
    let rightElbowY = -4;
    let rightHandX = 19;
    let rightHandY = 10;
    let leftShoulderX = -10;
    let rightShoulderX = 10;

    if (isRunning) {
      // At left-foot contact the right arm is forward, and vice versa.
      leftShoulderX = -RUNNING_SHOULDER_OFFSET_X;
      rightShoulderX = RUNNING_SHOULDER_OFFSET_X;
      const leftArm = this.getRunningArmPose(-1, -gaitWave);
      const rightArm = this.getRunningArmPose(1, gaitWave);
      ({ elbowX: leftElbowX, elbowY: leftElbowY, handX: leftHandX, handY: leftHandY } = leftArm);
      ({
        elbowX: rightElbowX,
        elbowY: rightElbowY,
        handX: rightHandX,
        handY: rightHandY,
      } = rightArm);
    } else if (isJumping) {
      leftElbowX = -19;
      leftElbowY = -13;
      leftHandX = -25;
      leftHandY = -25;
      rightElbowX = 18;
      rightElbowY = -10;
      rightHandX = 26;
      rightHandY = -18;
    } else if (isHurt) {
      leftElbowX = -18;
      leftElbowY = -4;
      leftHandX = -22;
      leftHandY = 8;
      rightElbowX = 19;
      rightElbowY = -12;
      rightHandX = 25;
      rightHandY = -25;
    } else if (isFinished) {
      leftElbowX = -20;
      leftElbowY = -30;
      leftHandX = -17;
      leftHandY = -49;
      rightElbowX = 20;
      rightElbowY = -30;
      rightHandX = 17;
      rightHandY = -49;
    }

    const leftArmPose = {
      elbowX: leftElbowX,
      elbowY: leftElbowY,
      handX: leftHandX,
      handY: leftHandY,
    };
    const rightArmPose = {
      elbowX: rightElbowX,
      elbowY: rightElbowY,
      handX: rightHandX,
      handY: rightHandY,
    };

    if (isRunning) {
      // Keep the far arm behind the torso throughout the cycle. A fixed layer
      // order avoids a visible pop whenever the arms cross the body.
      this.drawArm(graphics, leftShoulderX, leftArmPose, RUNNER_PALETTE.skinShadow);
    } else {
      this.drawArm(graphics, leftShoulderX, leftArmPose, RUNNER_PALETTE.skin);
      this.drawArm(graphics, rightShoulderX, rightArmPose, RUNNER_PALETTE.skin);
    }

    // Sleeveless running singlet with contrast side panels; deliberately blank
    // so it cannot be mistaken for a real team, event, or apparel brand.
    graphics.fillStyle(RUNNER_PALETTE.singlet, 1);
    graphics.fillRoundedRect(-14, -24, 28, 34, 7);
    graphics.fillStyle(RUNNER_PALETTE.singletPanel, 1);
    graphics.fillRoundedRect(-14, -15, 5, 22, 2);
    graphics.fillRoundedRect(9, -15, 5, 22, 2);
    graphics.fillStyle(RUNNER_PALETTE.skin, 1);
    graphics.fillRoundedRect(-4, -27, 8, 10, 4);
    graphics.fillCircle(0, -21, 5.5);
    graphics.lineStyle(2, 0xffffff, 0.75);
    graphics.strokeRoundedRect(-14, -24, 28, 34, 7);

    // Split running shorts and side piping keep both legs readable in motion.
    graphics.fillStyle(RUNNER_PALETTE.shorts, 1);
    graphics.fillRoundedRect(-15, 4, 14, 18, 4);
    graphics.fillRoundedRect(1, 4, 14, 18, 4);
    graphics.fillRect(-14, 4, 28, 6);
    graphics.fillStyle(RUNNER_PALETTE.shortsPanel, 1);
    graphics.fillRect(-14, 9, 3, 9);
    graphics.fillRect(11, 9, 3, 9);

    if (isRunning) {
      // The near arm remains above the singlet and shorts, so both the bent
      // elbow and hand stay legible at small mobile scales.
      this.drawArm(graphics, rightShoulderX, rightArmPose, RUNNER_PALETTE.skin);
    }

    graphics.fillStyle(RUNNER_PALETTE.skin, 1);
    graphics.fillCircle(0, -38, 13);
    graphics.fillStyle(RUNNER_PALETTE.hair, 1);
    graphics.fillCircle(4, -41, 1.8);
    graphics.fillRoundedRect(-13, -52, 25, 8, 4);

    if (isHurt) {
      graphics.lineStyle(3, RUNNER_PALETTE.hurt, 1);
      graphics.beginPath();
      graphics.moveTo(18, -38);
      graphics.lineTo(25, -45);
      graphics.moveTo(21, -31);
      graphics.lineTo(30, -31);
      graphics.strokePath();
    }

    if (isFinished) {
      graphics.lineStyle(2.5, RUNNER_PALETTE.hair, 1);
      graphics.beginPath();
      graphics.moveTo(-6, -35);
      graphics.lineTo(-2, -32);
      graphics.lineTo(4, -35);
      graphics.strokePath();
      graphics.lineStyle(3, RUNNER_PALETTE.shoeAccent, 1);
      graphics.beginPath();
      graphics.moveTo(-27, -48);
      graphics.lineTo(-33, -54);
      graphics.moveTo(27, -48);
      graphics.lineTo(33, -54);
      graphics.strokePath();
    }

    if (isGameOver) {
      graphics.lineStyle(2.5, RUNNER_PALETTE.hair, 1);
      graphics.beginPath();
      graphics.moveTo(-8, -43);
      graphics.lineTo(-3, -38);
      graphics.moveTo(-3, -43);
      graphics.lineTo(-8, -38);
      graphics.strokePath();
    }

    graphics.restore();
  }

  private getRunningLegPose(rawPhase: number): RunningLegPose {
    const phase = ((rawPhase % 1) + 1) % 1;
    const stanceRatio = 0.52;

    if (phase < stanceRatio) {
      const progress = this.smoothStep(phase / stanceRatio);
      const compression = Math.sin(progress * Math.PI);
      return {
        kneeX: this.lerp(5, -6, progress) + compression * 2,
        kneeY: 23 + compression * 2.5,
        footX: this.lerp(16, -14, progress),
        footY: SHOE_CONTACT_Y,
        isSupport: true,
      };
    }

    const progress = this.smoothStep((phase - stanceRatio) / (1 - stanceRatio));
    return {
      kneeX: this.quadraticBezier(-6, 10, 5, progress),
      kneeY: this.quadraticBezier(25, 16, 22, progress),
      footX: this.quadraticBezier(-14, -5, 16, progress),
      footY: this.quadraticBezier(SHOE_CONTACT_Y, 24, SHOE_CONTACT_Y - 1, progress),
      isSupport: false,
    };
  }

  private getRunningArmPose(side: -1 | 1, swing: number): RunningArmPose {
    const shoulderX = side * RUNNING_SHOULDER_OFFSET_X;
    const forwardProgress = this.smoothStep((swing + 1) / 2);

    return {
      // The upper and lower arm use separate keyframes so the elbow stays
      // flexed around 90 degrees instead of forming an unnatural straight line.
      elbowX: this.lerp(shoulderX - 12, shoulderX + 10, forwardProgress),
      elbowY: this.lerp(-3, -2, forwardProgress),
      handX: this.lerp(shoulderX - 4, shoulderX + 19, forwardProgress),
      handY: this.lerp(9, -12, forwardProgress),
    };
  }

  private drawArm(
    graphics: Phaser.GameObjects.Graphics,
    shoulderX: number,
    pose: RunningArmPose,
    color: number,
  ): void {
    graphics.lineStyle(8, color, 1);
    graphics.beginPath();
    graphics.moveTo(shoulderX, -15);
    graphics.lineTo(pose.elbowX, pose.elbowY);
    graphics.lineTo(pose.handX, pose.handY);
    graphics.strokePath();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(pose.handX, pose.handY, 4.5);
  }

  private drawLeg(graphics: Phaser.GameObjects.Graphics, hipX: number, pose: RunningLegPose): void {
    graphics.lineStyle(pose.isSupport ? 10 : 9, RUNNER_PALETTE.shorts, 0.18);
    graphics.beginPath();
    graphics.moveTo(hipX, 12);
    graphics.lineTo(pose.kneeX, pose.kneeY);
    graphics.lineTo(pose.footX, pose.footY - 3);
    graphics.strokePath();

    graphics.lineStyle(
      pose.isSupport ? 8 : 7,
      pose.isSupport ? RUNNER_PALETTE.skin : RUNNER_PALETTE.skinShadow,
      1,
    );
    graphics.beginPath();
    graphics.moveTo(hipX, 12);
    graphics.lineTo(pose.kneeX, pose.kneeY);
    graphics.lineTo(pose.footX, pose.footY - 3);
    graphics.strokePath();

    this.drawSock(graphics, pose.kneeX, pose.kneeY, pose.footX, pose.footY);
    this.drawRunningShoe(graphics, pose.footX, pose.footY, 1);
  }

  private drawSock(
    graphics: Phaser.GameObjects.Graphics,
    kneeX: number,
    kneeY: number,
    footX: number,
    footY: number,
  ): void {
    const sockX = kneeX + (footX - kneeX) * 0.68;
    const sockY = kneeY + (footY - kneeY) * 0.68;
    graphics.lineStyle(8, RUNNER_PALETTE.socks, 1);
    graphics.beginPath();
    graphics.moveTo(sockX, sockY);
    graphics.lineTo(footX, footY - 3);
    graphics.strokePath();
    graphics.lineStyle(2, RUNNER_PALETTE.singlet, 0.8);
    graphics.beginPath();
    graphics.moveTo(sockX - 3, sockY);
    graphics.lineTo(sockX + 3, sockY);
    graphics.strokePath();
  }

  private lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
  }

  private smoothStep(value: number): number {
    const clamped = Phaser.Math.Clamp(value, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
  }

  private quadraticBezier(start: number, control: number, end: number, amount: number): number {
    const inverse = 1 - amount;
    return inverse * inverse * start + 2 * inverse * amount * control + amount * amount * end;
  }

  private drawRunningShoe(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    direction: -1 | 1,
  ): void {
    const heelX = x - direction * 6;
    const toeX = x + direction * 10;
    const left = Math.min(heelX, toeX) - 1;
    const width = Math.abs(toeX - heelX) + 2;

    graphics.fillStyle(RUNNER_PALETTE.shoeOutsole, 1);
    graphics.fillRoundedRect(left, y, width, 5, 2.5);
    graphics.fillStyle(RUNNER_PALETTE.shoeMidsole, 1);
    graphics.fillRoundedRect(left, y - 2, width, 4, 2);
    graphics.fillStyle(RUNNER_PALETTE.shoeUpper, 1);
    graphics.beginPath();
    graphics.moveTo(heelX, y - 2);
    graphics.lineTo(heelX, y - 8);
    graphics.lineTo(x + direction * 2, y - 7);
    graphics.lineTo(toeX, y - 2);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(RUNNER_PALETTE.shoeAccent, 1);
    graphics.fillCircle(x + direction * 1.5, y - 4, 2);
    graphics.lineStyle(1.5, 0xffffff, 0.95);
    graphics.beginPath();
    graphics.moveTo(x - direction * 2, y - 6);
    graphics.lineTo(x + direction * 5, y - 4);
    graphics.strokePath();
  }
}
