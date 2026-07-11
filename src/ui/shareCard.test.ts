import {
  buildShareText,
  createShareCardFile,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type ShareCardInput,
} from './shareCard';

const COMPLETED_RESULT: ShareCardInput = {
  nickname: '慢跑小明',
  distanceMeters: 12_800,
  score: 12_345,
  outcome: 'completed',
  leaderboardRank: 3,
  stageNumber: 3,
  totalStages: 3,
  stageName: '正式比賽',
};

describe('分享成績文字', () => {
  it('完賽時顯示 42.195 公里、暱稱、分數、排行榜名次與免責', () => {
    const text = buildShareText(COMPLETED_RESULT);

    expect(text).toContain('慢跑小明');
    expect(text).toContain('馬拉松完賽訓練');
    expect(text).toContain('42.195 公里');
    expect(text).toContain('分數 12,345｜完賽');
    expect(text).toContain('排行榜第 3 名');
    expect(text).toContain('不作醫療診斷或個別建議');
  });

  it('中途停止時使用當次里程與抵達關卡', () => {
    const text = buildShareText({
      nickname: '阿跑',
      distanceMeters: 1_280,
      score: 880,
      outcome: 'stopped',
      stageNumber: 2,
      stageName: '進階期',
    });

    expect(text).toContain('1,280 公尺');
    expect(text).toContain('分數 880｜抵達第 2 關・進階期');
  });

  it('過長暱稱以 Unicode 字元安全截斷，非有限數值不會拋錯', () => {
    expect(() =>
      buildShareText({
        nickname: '超級馬拉松宇宙最強長跑選手永遠不停',
        distanceMeters: Number.NaN,
        score: Number.POSITIVE_INFINITY,
        outcome: 'stopped',
      }),
    ).not.toThrow();

    const text = buildShareText({
      nickname: '超級馬拉松宇宙最強長跑選手永遠不停',
      distanceMeters: Number.NaN,
      score: Number.POSITIVE_INFINITY,
      outcome: 'stopped',
    });
    expect(text).toContain('超級馬拉松宇宙最強長跑選手永遠不…');
    expect(text).toContain('0 公尺');
    expect(text).toContain('分數 0');
  });

  it('排行榜名次清楚區分尚未送出與已驗證但未進前 10 名', () => {
    expect(
      buildShareText({
        ...COMPLETED_RESULT,
        leaderboardRank: undefined,
      }),
    ).toContain('排行榜：尚未送出');
    expect(
      buildShareText({
        ...COMPLETED_RESULT,
        leaderboardRank: null,
      }),
    ).toContain('成績已驗證・目前未進前 10 名');
  });

  it('極端遊戲數值會限制在分享卡可讀範圍', () => {
    const text = buildShareText({
      ...COMPLETED_RESULT,
      score: Number.MAX_VALUE,
      distanceMeters: Number.MAX_VALUE,
      leaderboardRank: Number.MAX_VALUE,
    });

    expect(text).toContain('分數 999,999,999');
    expect(text).toContain('排行榜第 999,999 名');
  });
});

describe('分享成績卡 PNG', () => {
  it('Canvas context 不支援時安全回傳 null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);

    await expect(createShareCardFile(COMPLETED_RESULT)).resolves.toBeNull();
  });

  it('toBlob 失敗時安全回傳 null', async () => {
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(null);
    });

    await expect(createShareCardFile(COMPLETED_RESULT)).resolves.toBeNull();
  });

  it('產生適用 Facebook 與 Instagram 的 1080×1080 PNG File，並繪出名次', async () => {
    const context = createCanvasContextStub();
    let renderedCanvas: HTMLCanvasElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'canvas') renderedCanvas = element as HTMLCanvasElement;
      return element;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });

    const file = await createShareCardFile(COMPLETED_RESULT);

    expect(renderedCanvas?.width).toBe(SHARE_CARD_WIDTH);
    expect(renderedCanvas?.height).toBe(SHARE_CARD_HEIGHT);
    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('marathon-finish-training-score.png');
    expect(file?.type).toBe('image/png');
    expect(context.fillText).toHaveBeenCalledWith('#3', expect.any(Number), expect.any(Number));
    expect(context.arc).toHaveBeenCalledWith(113, 74, 5.5, 0, Math.PI * 2);
    expect(context.stroke).toHaveBeenCalled();

    await createShareCardFile({ ...COMPLETED_RESULT, leaderboardRank: null });
    await createShareCardFile({ ...COMPLETED_RESULT, leaderboardRank: undefined });
    expect(context.fillText).toHaveBeenCalledWith(
      'TOP 10 外',
      expect.any(Number),
      expect.any(Number),
    );
    expect(context.fillText).toHaveBeenCalledWith('待驗證', expect.any(Number), expect.any(Number));
  });
});

function createCanvasContextStub(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  return {
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 30 }) as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}
