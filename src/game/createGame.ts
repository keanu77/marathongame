import Phaser from 'phaser';

import { GAME_CONFIG } from './config/gameConfig';
import { GameScene } from './scenes/GameScene';

export function createGame(parent: string): Phaser.Game {
  const renderWidth = GAME_CONFIG.canvasWidth * GAME_CONFIG.renderScale;
  const renderHeight = GAME_CONFIG.canvasHeight * GAME_CONFIG.renderScale;

  const game = new Phaser.Game({
    // 本遊戲只有 2D 幾何圖形；Canvas 可避免部分手機與無頭瀏覽器的 WebGL framebuffer 相容問題。
    type: Phaser.CANVAS,
    parent,
    backgroundColor: '#a8e8f0',
    transparent: false,
    width: renderWidth,
    height: renderHeight,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: renderWidth,
      height: renderHeight,
    },
    input: {
      activePointers: 3,
      touch: {
        capture: true,
      },
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scene: [GameScene],
    banner: false,
  });

  const configureCanvas = (): void => {
    const canvas = game.canvas;
    if (!canvas) return;

    canvas.dataset.testid = 'game-canvas';
    canvas.setAttribute('aria-label', '馬拉松完賽訓練遊戲畫布');
    canvas.setAttribute('role', 'application');
    canvas.tabIndex = 0;
  };

  if (game.canvas) {
    configureCanvas();
  } else {
    game.events.once(Phaser.Core.Events.BOOT, configureCanvas);
  }

  return game;
}
