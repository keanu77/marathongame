import Phaser from 'phaser';

import {
  RUNNER_ANIMATION_SPECS,
  RUNNER_SPRITE_SHEET,
  type RunnerAnimationState,
} from '../config/runnerAnimationConfig';

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
  sweat: 0x78c7e8,
} as const;

const SHOE_CONTACT_Y = 38;
const FOOT_BASELINE_Y = 43;
const HIP_Y = 12;
const RUNNING_SHOULDER_OFFSET_X = 4;

interface LegPose {
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
  shoeAngle: number;
  isSupport: boolean;
}

interface ArmPose {
  elbowX: number;
  elbowY: number;
  handX: number;
  handY: number;
}

interface FrameLocation {
  state: RunnerAnimationState;
  localFrame: number;
  frameCount: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function smoothStep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutBack(value: number): number {
  const clamped = clamp(value, 0, 1);
  const overshoot = 1.35;
  return 1 + (overshoot + 1) * (clamped - 1) ** 3 + overshoot * (clamped - 1) ** 2;
}

function quadraticBezier(start: number, control: number, end: number, amount: number): number {
  const inverse = 1 - amount;
  return inverse * inverse * start + 2 * inverse * amount * control + amount * amount * end;
}

/** Lowest rotated outsole point relative to the ankle anchor. */
function getShoeBottomOffset(angle: number): number {
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const left = -7;
  const right = 12;
  const top = 0;
  const bottom = 4.6;
  return Math.max(
    left * sine + top * cosine,
    left * sine + bottom * cosine,
    right * sine + top * cosine,
    right * sine + bottom * cosine,
  );
}

function getGroundedShoeAnchorY(angle: number): number {
  return FOOT_BASELINE_Y - getShoeBottomOffset(angle);
}

function setLegPose(
  pose: LegPose,
  kneeX: number,
  kneeY: number,
  footX: number,
  footY: number,
  shoeAngle: number,
  isSupport: boolean,
): void {
  pose.kneeX = kneeX;
  pose.kneeY = kneeY;
  pose.footX = footX;
  pose.footY = footY;
  pose.shoeAngle = shoeAngle;
  pose.isSupport = isSupport;
}

function setArmPose(
  pose: ArmPose,
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

function createLegPose(): LegPose {
  return {
    kneeX: 0,
    kneeY: 25,
    footX: 0,
    footY: SHOE_CONTACT_Y,
    shoeAngle: 0,
    isSupport: true,
  };
}

function createArmPose(): ArmPose {
  return { elbowX: 0, elbowY: -4, handX: 0, handY: 8 };
}

function resolveFrameLocation(frameIndex: number): FrameLocation {
  for (const state of Object.keys(RUNNER_ANIMATION_SPECS) as RunnerAnimationState[]) {
    const stateFrames = RUNNER_ANIMATION_SPECS[state].frames;
    const localFrame = stateFrames.indexOf(frameIndex);
    if (localFrame >= 0) {
      return { state, localFrame, frameCount: stateFrames.length };
    }
  }

  return { state: 'idle', localFrame: 0, frameCount: RUNNER_ANIMATION_SPECS.idle.frames.length };
}

function getRunningLegPose(rawPhase: number, output: LegPose): void {
  const phase = ((rawPhase % 1) + 1) % 1;
  const stanceRatio = 0.46;

  if (phase < stanceRatio) {
    const progress = smoothStep(phase / stanceRatio);
    const compression = Math.sin(progress * Math.PI);
    output.kneeX = lerp(6, -7, progress) + compression * 2;
    output.kneeY = 23 + compression * 3.1;
    output.footX = lerp(17, -15, progress);
    output.shoeAngle = lerp(-0.17, 0.24, progress);
    output.footY = getGroundedShoeAnchorY(output.shoeAngle);
    output.isSupport = true;
    return;
  }

  const progress = smoothStep((phase - stanceRatio) / (1 - stanceRatio));
  output.kneeX = quadraticBezier(-7, 13, 6, progress);
  output.kneeY = quadraticBezier(25, 14, 22, progress);
  output.footX = quadraticBezier(-15, -8, 17, progress);
  output.footY = quadraticBezier(SHOE_CONTACT_Y - 1, 22, SHOE_CONTACT_Y - 1, progress);
  output.shoeAngle = quadraticBezier(0.34, -0.08, -0.16, progress);
  output.isSupport = false;
}

function getRunningArmPose(side: -1 | 1, swing: number, output: ArmPose): void {
  const shoulderX = side * RUNNING_SHOULDER_OFFSET_X;
  const forwardProgress = smoothStep((swing + 1) / 2);

  output.elbowX = lerp(shoulderX - 12, shoulderX + 10, forwardProgress);
  output.elbowY = lerp(-3, -5, forwardProgress);
  output.handX = lerp(shoulderX - 5, shoulderX + 18, forwardProgress);
  output.handY = lerp(9, -12, forwardProgress);
}

function setJumpPose(
  localFrame: number,
  farLeg: LegPose,
  nearLeg: LegPose,
  farArm: ArmPose,
  nearArm: ArmPose,
): { upperBodyOffsetY: number; upperBodyLean: number } {
  if (localFrame <= 1) {
    const extension = localFrame;
    setLegPose(farLeg, -7, 24 - extension, -16 - extension, 37, 0.27, false);
    setLegPose(nearLeg, 11, 19 - extension * 2, 2 - extension, 31 - extension, -0.12, false);
    setArmPose(farArm, -13, -2, -18, 9);
    setArmPose(nearArm, 14, -9 - extension, 21, -17 - extension);
    return { upperBodyOffsetY: -1, upperBodyLean: 0.12 - extension * 0.025 };
  }

  if (localFrame <= 3) {
    const tuck = localFrame - 2;
    setLegPose(farLeg, -7, 23 - tuck, -19, 33 - tuck, 0.18, false);
    setLegPose(nearLeg, 12, 15 - tuck, 2, 29 - tuck, -0.18, false);
    setArmPose(farArm, -13, -2, -18, 9);
    setArmPose(nearArm, 14, -11, 21, -19);
    return { upperBodyOffsetY: -1.5 - tuck * 0.5, upperBodyLean: 0.08 - tuck * 0.015 };
  }

  if (localFrame <= 5) {
    const float = localFrame - 4;
    setLegPose(farLeg, -10, 18 - float, -4, 30 - float, 0.05, false);
    setLegPose(nearLeg, 11, 18 - float, 5, 30 - float, -0.08, false);
    setArmPose(farArm, -18, -12, -27, -6 - float);
    setArmPose(nearArm, 18, -12, 27, -6 - float);
    return { upperBodyOffsetY: -2.5, upperBodyLean: 0.045 };
  }

  const prepareToLand = localFrame - 6;
  setLegPose(farLeg, -8, 22 + prepareToLand, -15, 32 + prepareToLand, 0.12, false);
  setLegPose(nearLeg, 9, 22 + prepareToLand, 20, 37 + prepareToLand, -0.18, false);
  setArmPose(farArm, -19, -9, -27, -2 + prepareToLand);
  setArmPose(nearArm, 19, -9, 27, -2 + prepareToLand);
  return { upperBodyOffsetY: -0.5 + prepareToLand * 0.5, upperBodyLean: 0.025 };
}

function drawTorso(
  graphics: Phaser.GameObjects.Graphics,
  withMedal: boolean,
  breathAmount: number,
): void {
  const torsoHeight = 35 + breathAmount * 0.35;
  graphics.lineStyle(2, RUNNER_PALETTE.outline, 0.3);
  graphics.fillStyle(RUNNER_PALETTE.singlet, 1);
  graphics.fillRoundedRect(-14, -25, 28, torsoHeight, 7);
  graphics.strokeRoundedRect(-14, -25, 28, torsoHeight, 7);

  graphics.fillStyle(RUNNER_PALETTE.singletHighlight, 1);
  graphics.fillRoundedRect(-13, -22, 4, 26, 2);

  // The orange band is this original runner's identity accent, not a brand logo.
  graphics.fillStyle(RUNNER_PALETTE.identityBand, 1);
  graphics.fillRoundedRect(-13, -11, 26, 7, 2);
  graphics.fillStyle(RUNNER_PALETTE.identityBandLight, 0.8);
  graphics.fillRoundedRect(-11, -10, 9, 2, 1);

  graphics.lineStyle(1.2, RUNNER_PALETTE.outline, 0.18);
  graphics.beginPath();
  graphics.moveTo(-6, -2);
  graphics.lineTo(-3, 1);
  graphics.moveTo(6, -2);
  graphics.lineTo(3, 1);
  graphics.strokePath();

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

function drawHead(
  graphics: Phaser.GameObjects.Graphics,
  state: RunnerAnimationState,
  blink: boolean,
): void {
  graphics.fillStyle(RUNNER_PALETTE.skin, 1);
  graphics.fillCircle(1, -39, 13);
  graphics.fillTriangle(11, -42, 16, -39, 11, -36);
  graphics.fillStyle(RUNNER_PALETTE.skinShadow, 1);
  graphics.fillCircle(-10, -39, 3);

  graphics.fillStyle(RUNNER_PALETTE.cap, 1);
  graphics.fillRoundedRect(-12, -52, 25, 9, 4);
  graphics.fillStyle(RUNNER_PALETTE.capHighlight, 1);
  graphics.fillRoundedRect(-8, -51, 17, 3, 1.5);
  graphics.fillStyle(RUNNER_PALETTE.identityBand, 1);
  graphics.fillRect(-11, -45, 23, 2.5);
  graphics.fillStyle(RUNNER_PALETTE.cap, 1);
  graphics.fillRoundedRect(9, -45, 13, 3.5, 1.5);

  graphics.fillStyle(RUNNER_PALETTE.outline, 1);
  if (state === 'gameOver') {
    graphics.lineStyle(2, RUNNER_PALETTE.outline, 1);
    graphics.beginPath();
    graphics.moveTo(4, -42);
    graphics.lineTo(9, -38);
    graphics.moveTo(9, -42);
    graphics.lineTo(4, -38);
    graphics.strokePath();
  } else if (blink) {
    graphics.lineStyle(1.8, RUNNER_PALETTE.outline, 1);
    graphics.beginPath();
    graphics.moveTo(5, -40);
    graphics.lineTo(9, -40);
    graphics.strokePath();
  } else {
    graphics.fillCircle(7, -41, state === 'hurt' ? 2 : 1.5);
    graphics.fillStyle(RUNNER_PALETTE.skinHighlight, 0.75);
    graphics.fillCircle(8, -42, 0.55);
  }

  graphics.lineStyle(1.8, RUNNER_PALETTE.outline, 0.9);
  graphics.beginPath();
  if (state === 'finished') {
    graphics.moveTo(3, -34);
    graphics.lineTo(7, -31.5);
    graphics.lineTo(11, -35);
  } else if (state === 'hurt' || state === 'gameOver') {
    graphics.moveTo(4, -33);
    graphics.lineTo(7, -36);
    graphics.lineTo(10, -34);
  } else {
    graphics.moveTo(5, -34);
    graphics.lineTo(9, -34);
  }
  graphics.strokePath();
}

function drawArm(
  graphics: Phaser.GameObjects.Graphics,
  shoulderX: number,
  pose: ArmPose,
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

function drawRunningShoe(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  opacity: number,
  drawContactPatch: boolean,
): void {
  graphics.save();
  graphics.translateCanvas(x, y);
  graphics.rotateCanvas(angle);

  const heelX = -6;
  const toeX = 11;
  const left = heelX - 1;
  const width = toeX - heelX + 2;

  graphics.fillStyle(RUNNER_PALETTE.shoeOutsole, opacity);
  graphics.fillRoundedRect(left, 0, width, 4.6, 2.3);
  graphics.fillStyle(RUNNER_PALETTE.shoeMidsole, opacity);
  graphics.fillRoundedRect(left, -2, width, 4, 2);
  graphics.fillStyle(RUNNER_PALETTE.shoeUpper, opacity);
  graphics.beginPath();
  graphics.moveTo(heelX, -2);
  graphics.lineTo(heelX, -8);
  graphics.lineTo(2, -7);
  graphics.lineTo(toeX, -2);
  graphics.closePath();
  graphics.fillPath();
  graphics.fillStyle(RUNNER_PALETTE.shoeAccent, opacity);
  graphics.fillCircle(2, -4, 2);
  graphics.lineStyle(1.5, 0xffffff, opacity * 0.95);
  graphics.beginPath();
  graphics.moveTo(-2, -6);
  graphics.lineTo(6, -4);
  graphics.strokePath();
  graphics.lineStyle(1.1, RUNNER_PALETTE.shoeOutsole, opacity * 0.7);
  graphics.beginPath();
  graphics.moveTo(-4, 3.5);
  graphics.lineTo(8, 3.5);
  graphics.strokePath();
  graphics.restore();

  if (drawContactPatch) {
    // A tiny outsole contact patch removes sub-pixel baseline shimmer after
    // rotating the shoe while remaining visually part of the dark outsole.
    graphics.fillStyle(RUNNER_PALETTE.shoeOutsole, opacity);
    graphics.fillRect(x - 2, FOOT_BASELINE_Y - 1, 4, 1);
  }
}

function drawSock(
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

function drawLeg(
  graphics: Phaser.GameObjects.Graphics,
  hipX: number,
  pose: LegPose,
  isNear: boolean,
  useGroundBaseline: boolean,
): void {
  const skinColor = isNear ? RUNNER_PALETTE.skin : RUNNER_PALETTE.skinShadow;
  const opacity = isNear ? 1 : 0.88;
  const groundedShoeY = getGroundedShoeAnchorY(pose.shoeAngle);
  const footY = useGroundBaseline
    ? pose.isSupport
      ? groundedShoeY
      : Math.min(pose.footY, groundedShoeY - 0.75)
    : pose.footY;

  graphics.lineStyle(isNear ? 10 : 9, RUNNER_PALETTE.shorts, opacity);
  graphics.beginPath();
  graphics.moveTo(hipX, HIP_Y);
  graphics.lineTo(pose.kneeX, pose.kneeY);
  graphics.strokePath();

  graphics.lineStyle(isNear ? 7.5 : 6.5, skinColor, opacity);
  graphics.beginPath();
  graphics.moveTo(pose.kneeX, pose.kneeY);
  graphics.lineTo(pose.footX, footY - 4);
  graphics.strokePath();
  graphics.fillStyle(skinColor, opacity);
  graphics.fillCircle(pose.kneeX, pose.kneeY, isNear ? 4.3 : 3.8);

  drawSock(graphics, pose.kneeX, pose.kneeY, pose.footX, footY, opacity);
  drawRunningShoe(
    graphics,
    pose.footX,
    footY,
    pose.shoeAngle,
    opacity,
    useGroundBaseline && pose.isSupport,
  );
}

function drawHurtAccent(graphics: Phaser.GameObjects.Graphics, pulse: number): void {
  graphics.lineStyle(2.5 + pulse * 0.8, RUNNER_PALETTE.hurt, 1);
  graphics.beginPath();
  graphics.moveTo(18, -38);
  graphics.lineTo(25, -46);
  graphics.moveTo(21, -31);
  graphics.lineTo(31, -31);
  graphics.moveTo(19, -35);
  graphics.lineTo(27, -38);
  graphics.strokePath();
}

function drawFinishAccent(graphics: Phaser.GameObjects.Graphics, progress: number): void {
  const spread = 4 + progress * 4;
  graphics.lineStyle(2.5, RUNNER_PALETTE.identityBandLight, progress);
  graphics.beginPath();
  graphics.moveTo(-28, -45);
  graphics.lineTo(-28 - spread, -49 - spread * 0.35);
  graphics.moveTo(-29, -37);
  graphics.lineTo(-31 - spread, -37);
  graphics.moveTo(28, -45);
  graphics.lineTo(28 + spread, -49 - spread * 0.35);
  graphics.moveTo(29, -37);
  graphics.lineTo(31 + spread, -37);
  graphics.strokePath();
}

function drawFatigueAccent(graphics: Phaser.GameObjects.Graphics, progress: number): void {
  graphics.fillStyle(RUNNER_PALETTE.sweat, 0.45 + progress * 0.45);
  graphics.fillCircle(18, -31 + progress * 2, 2.6);
  graphics.fillTriangle(15.5, -31, 20.5, -31, 18, -37);
}

/**
 * Draw one deterministic animation frame. Every pose uses the same skeleton,
 * palette and foot anchor so the generated sheet cannot suffer AI-style frame drift.
 */
export function drawRunnerFrame(graphics: Phaser.GameObjects.Graphics, frameIndex: number): void {
  const { state, localFrame, frameCount } = resolveFrameLocation(frameIndex);
  const farLeg = createLegPose();
  const nearLeg = createLegPose();
  const farArm = createArmPose();
  const nearArm = createArmPose();
  const normalizedFrame = frameCount > 1 ? localFrame / (frameCount - 1) : 0;
  const loopPhase = localFrame / frameCount;

  let upperBodyOffsetY = 0;
  let upperBodyLean = 0;
  let wholeBodyOffsetX = 0;
  let farShoulderX = -10;
  let nearShoulderX = 10;
  let breathAmount = 0;

  setLegPose(farLeg, -8, 25, -14, SHOE_CONTACT_Y, 0, true);
  setLegPose(nearLeg, 8, 25, 14, SHOE_CONTACT_Y, 0, true);
  setArmPose(farArm, -14, -5, -18, 10);
  setArmPose(nearArm, 14, -5, 18, 9);

  if (state === 'idle') {
    const breathWave = Math.sin(loopPhase * Math.PI * 2);
    const weightShift = Math.sin(loopPhase * Math.PI * 2 + Math.PI / 2);
    breathAmount = (breathWave + 1) / 2;
    upperBodyOffsetY = -breathAmount * 0.8;
    wholeBodyOffsetX = weightShift * 0.45;
    setLegPose(farLeg, -8, 25, -13, SHOE_CONTACT_Y, 0, true);
    setLegPose(nearLeg, 8, 25, 13 + weightShift * 0.5, SHOE_CONTACT_Y, 0, true);
    setArmPose(farArm, -14, -5 - breathAmount, -18, 9 - breathAmount);
    setArmPose(nearArm, 14, -5 - breathAmount, 18, 8 - breathAmount);
  } else if (state === 'running') {
    const gaitCycle = loopPhase;
    const gaitWave = Math.cos(gaitCycle * Math.PI * 2);
    getRunningLegPose(gaitCycle, farLeg);
    getRunningLegPose(gaitCycle + 0.5, nearLeg);
    farShoulderX = -RUNNING_SHOULDER_OFFSET_X;
    nearShoulderX = RUNNING_SHOULDER_OFFSET_X;
    getRunningArmPose(-1, -gaitWave, farArm);
    getRunningArmPose(1, gaitWave, nearArm);
    upperBodyOffsetY = -Math.abs(Math.sin(gaitCycle * Math.PI * 2)) * 1.7;
    upperBodyLean = 0.09;
    breathAmount = 0.35 + Math.abs(gaitWave) * 0.2;
  } else if (state === 'jumping') {
    const jumpPose = setJumpPose(localFrame, farLeg, nearLeg, farArm, nearArm);
    upperBodyOffsetY = jumpPose.upperBodyOffsetY;
    upperBodyLean = jumpPose.upperBodyLean;
    farShoulderX = -RUNNING_SHOULDER_OFFSET_X;
    nearShoulderX = RUNNING_SHOULDER_OFFSET_X;
    breathAmount = 0.45;
  } else if (state === 'hurt') {
    const recoil = [0, 1, 0.55, 0.2][localFrame] ?? 0;
    const shake = [-1.4, 1.8, -0.8, 0.4][localFrame] ?? 0;
    setLegPose(farLeg, -10, 25 + recoil * 2, -17, SHOE_CONTACT_Y, 0.12, true);
    setLegPose(nearLeg, 9, 23 - recoil * 4, 12, 33 - recoil * 4, -0.12, false);
    setArmPose(farArm, -18, -7, -24, 3);
    setArmPose(nearArm, 14, -7 - recoil * 2, 5, -4 - recoil * 3);
    upperBodyLean = -0.08 - recoil * 0.07;
    wholeBodyOffsetX = shake;
    upperBodyOffsetY = 1;
  } else if (state === 'finished') {
    const celebration = easeOutBack(normalizedFrame);
    const settleBounce = localFrame >= 5 ? Math.sin(((localFrame - 5) / 2) * Math.PI) * 0.8 : 0;
    setLegPose(farLeg, -8, 25, -13, SHOE_CONTACT_Y, 0, true);
    setLegPose(nearLeg, 8, 25, 13, SHOE_CONTACT_Y, 0, true);
    setArmPose(
      farArm,
      lerp(-14, -17, celebration),
      lerp(-5, -31, celebration),
      lerp(-18, -23, celebration),
      lerp(10, -49, celebration),
    );
    setArmPose(
      nearArm,
      lerp(14, 17, celebration),
      lerp(-5, -31, celebration),
      lerp(18, 23, celebration),
      lerp(9, -49, celebration),
    );
    upperBodyOffsetY = -celebration * 1.5 - settleBounce;
    breathAmount = 0.5;
  } else if (state === 'gameOver') {
    const fatigue = smoothStep(normalizedFrame);
    setLegPose(farLeg, -7, 26 + fatigue * 2, -11, SHOE_CONTACT_Y, 0.04, true);
    setLegPose(nearLeg, 9, 26 + fatigue * 3, 15, SHOE_CONTACT_Y, -0.02, true);
    setArmPose(
      farArm,
      lerp(-14, -7, fatigue),
      lerp(-5, 0, fatigue),
      lerp(-18, -2, fatigue),
      lerp(10, 15, fatigue),
    );
    setArmPose(
      nearArm,
      lerp(14, 11, fatigue),
      lerp(-5, 1, fatigue),
      lerp(18, 15, fatigue),
      lerp(9, 16, fatigue),
    );
    upperBodyLean = fatigue * 0.32;
    upperBodyOffsetY = fatigue * 3;
  }

  const blink = (state === 'idle' && localFrame === frameCount - 1) || state === 'gameOver';

  graphics.save();
  graphics.translateCanvas(wholeBodyOffsetX, 0);

  const useGroundBaseline = state !== 'jumping';
  drawLeg(graphics, -6, farLeg, false, useGroundBaseline);
  drawLeg(graphics, 6, nearLeg, true, useGroundBaseline);

  graphics.save();
  graphics.translateCanvas(0, upperBodyOffsetY);
  if (upperBodyLean !== 0) graphics.rotateCanvas(upperBodyLean);

  drawArm(graphics, farShoulderX, farArm, false);
  drawTorso(graphics, state === 'finished', breathAmount);
  drawArm(graphics, nearShoulderX, nearArm, true);
  drawHead(graphics, state, blink);

  if (state === 'hurt') drawHurtAccent(graphics, normalizedFrame);
  if (state === 'finished') drawFinishAccent(graphics, normalizedFrame);
  if (state === 'gameOver') drawFatigueAccent(graphics, normalizedFrame);

  graphics.restore();
  graphics.restore();
}

/** Draw all 48 deterministic vector frames into the configured 8 × 6 sheet. */
export function drawRunnerSpriteSheet(graphics: Phaser.GameObjects.Graphics): void {
  const logicalFrameWidth = RUNNER_SPRITE_SHEET.frameWidth * RUNNER_SPRITE_SHEET.displayScale;
  const logicalFrameHeight = RUNNER_SPRITE_SHEET.frameHeight * RUNNER_SPRITE_SHEET.displayScale;
  const logicalOriginX = RUNNER_SPRITE_SHEET.anchorX * RUNNER_SPRITE_SHEET.displayScale;
  const logicalOriginY =
    RUNNER_SPRITE_SHEET.footBaselineY * RUNNER_SPRITE_SHEET.displayScale -
    RUNNER_SPRITE_SHEET.localFootBaselineY;

  graphics.clear();
  graphics.save();
  graphics.scaleCanvas(1 / RUNNER_SPRITE_SHEET.displayScale, 1 / RUNNER_SPRITE_SHEET.displayScale);

  for (let frameIndex = 0; frameIndex < RUNNER_SPRITE_SHEET.frameCount; frameIndex += 1) {
    const column = frameIndex % RUNNER_SPRITE_SHEET.columns;
    const row = Math.floor(frameIndex / RUNNER_SPRITE_SHEET.columns);
    graphics.save();
    graphics.translateCanvas(
      column * logicalFrameWidth + logicalOriginX,
      row * logicalFrameHeight + logicalOriginY,
    );
    drawRunnerFrame(graphics, frameIndex);
    graphics.restore();
  }

  graphics.restore();
}
