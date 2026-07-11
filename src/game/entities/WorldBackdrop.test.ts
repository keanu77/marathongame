import { getBackdropScrollDeltas } from './WorldBackdrop';

describe('WorldBackdrop 高解析視差', () => {
  it('1× 遠景與 2× 近景會維持相同的邏輯捲動速度', () => {
    const scroll = getBackdropScrollDeltas(300, 1_000, 2);

    expect(scroll.atmosphere).toBeCloseTo(7.5);
    expect(scroll.far).toBeCloseTo(21);
    expect(scroll.middle).toBeCloseTo(54);
    expect(scroll.near / 2).toBeCloseTo(108);
    expect(scroll.ground / 2).toBeCloseTo(300);
    expect(scroll.lane / 2).toBeCloseTo(300);
  });

  it('無效或負值不會造成背景反向跳動', () => {
    expect(getBackdropScrollDeltas(Number.NaN, 16, 2).ground).toBe(0);
    expect(getBackdropScrollDeltas(300, -16, 2).ground).toBe(0);
  });
});
