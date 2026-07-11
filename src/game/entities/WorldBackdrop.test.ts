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

  it('1.5× 平衡模式不會改變跑道與近景的邏輯速度', () => {
    const scroll = getBackdropScrollDeltas(440, 500, 1.5);

    expect(scroll.near / 1.5).toBeCloseTo(79.2);
    expect(scroll.ground / 1.5).toBeCloseTo(220);
    expect(scroll.lane / 1.5).toBeCloseTo(220);
  });

  it('無效或負值不會造成背景反向跳動', () => {
    expect(getBackdropScrollDeltas(Number.NaN, 16, 2).ground).toBe(0);
    expect(getBackdropScrollDeltas(300, -16, 2).ground).toBe(0);
    expect(getBackdropScrollDeltas(300, 16, Number.NaN).ground).toBeCloseTo(4.8);
  });
});
