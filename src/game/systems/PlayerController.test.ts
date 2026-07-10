import type Phaser from 'phaser';

import type { Player } from '../entities/Player';
import { PlayerController } from './PlayerController';

vi.mock('phaser', () => ({
  default: {
    Input: { Events: { POINTER_DOWN: 'pointerdown' } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

function createController(jumpBufferSeconds = 0.12) {
  const scene = {
    input: {
      on: vi.fn(),
      off: vi.fn(),
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
      },
    },
    events: {
      once: vi.fn(),
    },
  } as unknown as Phaser.Scene;
  const jump = vi.fn<() => boolean>();
  const onJump = vi.fn();
  const controller = new PlayerController(
    scene,
    { jump } as unknown as Player,
    720,
    onJump,
    jumpBufferSeconds,
  );

  return { controller, jump, onJump };
}

describe('PlayerController jump buffer', () => {
  it('落地前的跳躍輸入會在緩衝期限內自動執行', () => {
    let canJump = false;
    const { controller, jump, onJump } = createController();
    jump.mockImplementation(() => canJump);
    controller.setEnabled(true);

    controller.tryJump();
    controller.update(70);
    canJump = true;
    controller.update(40);

    expect(jump).toHaveBeenCalledTimes(3);
    expect(jump).toHaveBeenLastCalledWith(720);
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it('緩衝到期後不會在稍後落地時起跳', () => {
    let canJump = false;
    const { controller, jump, onJump } = createController();
    jump.mockImplementation(() => canJump);
    controller.setEnabled(true);

    controller.tryJump();
    controller.update(121);
    canJump = true;
    controller.update(0);

    expect(jump).toHaveBeenCalledTimes(2);
    expect(onJump).not.toHaveBeenCalled();
  });

  it('低幀率的落地幀會先消耗有效輸入，再扣除該幀時間', () => {
    let canJump = false;
    const { controller, jump, onJump } = createController();
    jump.mockImplementation(() => canJump);
    controller.setEnabled(true);

    controller.tryJump();
    controller.update(90);
    canJump = true;
    controller.update(50);

    expect(jump).toHaveBeenCalledTimes(3);
    expect(onJump).toHaveBeenCalledOnce();
  });

  it('停用控制器會清除尚未消耗的跳躍輸入', () => {
    let canJump = false;
    const { controller, jump, onJump } = createController();
    jump.mockImplementation(() => canJump);
    controller.setEnabled(true);

    controller.tryJump();
    controller.setEnabled(false);
    controller.setEnabled(true);
    canJump = true;
    controller.update(0);

    expect(jump).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalled();
  });

  it('可立即跳躍時只執行一次並不留下緩衝輸入', () => {
    const { controller, jump, onJump } = createController();
    jump.mockReturnValue(true);
    controller.setEnabled(true);

    controller.tryJump();
    controller.update(50);

    expect(jump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});
