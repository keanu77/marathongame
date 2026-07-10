import { advanceRemainingGameTimeMs } from './gameTimeSystem';

describe('advanceRemainingGameTimeMs', () => {
  it('只在遊戲時間運行時扣除經過時間', () => {
    expect(advanceRemainingGameTimeMs(800, 100, true)).toBe(700);
    expect(advanceRemainingGameTimeMs(700, 1_000, false)).toBe(700);
    expect(advanceRemainingGameTimeMs(700, 200, true)).toBe(500);
  });

  it('不會低於零', () => {
    expect(advanceRemainingGameTimeMs(150, 200, true)).toBe(0);
  });

  it('啟用效果的同一幀不會先燒掉完整 delta', () => {
    expect(advanceRemainingGameTimeMs(800, 50, true, true)).toBe(800);
    expect(advanceRemainingGameTimeMs(800, 50, true, false)).toBe(750);
  });

  it('會把非有限或負數輸入正規化', () => {
    expect(advanceRemainingGameTimeMs(Number.NaN, 20, true)).toBe(0);
    expect(advanceRemainingGameTimeMs(300, Number.POSITIVE_INFINITY, true)).toBe(300);
    expect(advanceRemainingGameTimeMs(-50, 20, false)).toBe(0);
  });
});
