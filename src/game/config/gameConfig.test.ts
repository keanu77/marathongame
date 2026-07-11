import { normalizeRenderScale, selectRenderQualityProfile } from './gameConfig';

describe('自適應畫質選擇', () => {
  it('高 DPI 且資源充足時保留 2× backing buffer', () => {
    expect(
      selectRenderQualityProfile({
        devicePixelRatio: 3,
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
      }),
    ).toEqual({ id: 'high', renderScale: 2 });
  });

  it('fractional DPR 會向上選擇足以避免瀏覽器放大的倍率', () => {
    expect(
      selectRenderQualityProfile({
        devicePixelRatio: 1.25,
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
      }),
    ).toEqual({ id: 'balanced', renderScale: 1.5 });

    expect(
      selectRenderQualityProfile({
        devicePixelRatio: 1.75,
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
      }),
    ).toEqual({ id: 'high', renderScale: 2 });
  });

  it('高 DPI 裝置遇到中度資源限制時降一級為 1.5×', () => {
    expect(
      selectRenderQualityProfile({
        devicePixelRatio: 3,
        hardwareConcurrency: 4,
        deviceMemoryGb: 8,
      }),
    ).toEqual({ id: 'balanced', renderScale: 1.5 });
  });

  it('省流量、低核心、低記憶體或 1× 螢幕會優先節省資源', () => {
    const economyCases = [
      { devicePixelRatio: 3, saveData: true },
      { devicePixelRatio: 3, prefersReducedData: true },
      { devicePixelRatio: 3, hardwareConcurrency: 2 },
      { devicePixelRatio: 3, deviceMemoryGb: 2 },
      { devicePixelRatio: 1, hardwareConcurrency: 12, deviceMemoryGb: 16 },
    ];

    for (const capabilities of economyCases) {
      expect(selectRenderQualityProfile(capabilities)).toEqual({
        id: 'economy',
        renderScale: 1,
      });
    }
  });

  it('缺少或無效的能力資料時不會拋錯，也不會誤用超高解析度', () => {
    expect(selectRenderQualityProfile({})).toEqual({ id: 'economy', renderScale: 1 });
    expect(
      selectRenderQualityProfile({
        devicePixelRatio: Number.NaN,
        hardwareConcurrency: 0,
        deviceMemoryGb: -1,
      }),
    ).toEqual({ id: 'economy', renderScale: 1 });
  });

  it('場景只接受支援的 1×、1.5×、2× 倍率', () => {
    expect(normalizeRenderScale(Number.NaN)).toBe(1);
    expect(normalizeRenderScale(0.8)).toBe(1);
    expect(normalizeRenderScale(1.25)).toBe(1.5);
    expect(normalizeRenderScale(1.8)).toBe(1.5);
    expect(normalizeRenderScale(2.5)).toBe(2);
  });
});
