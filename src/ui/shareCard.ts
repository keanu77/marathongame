/** Instagram 與 Facebook 貼文皆可直接使用的 1:1 方形成績卡。 */
export const SHARE_CARD_WIDTH = 1_080;
export const SHARE_CARD_HEIGHT = 1_080;

const GAME_TITLE = '馬拉松完賽訓練';
const DISCLAIMER = '本遊戲僅供一般運動衛教與娛樂，不作醫療診斷或個別建議。';
const MAX_NICKNAME_LENGTH = 16;
const MAX_STAGE_NAME_LENGTH = 14;
const MAX_SHARE_VALUE = 999_999_999;
const MAX_SHARE_RANK = 999_999;

export type ShareCardOutcome = 'completed' | 'stopped';

export interface ShareCardInput {
  nickname?: string | null;
  distanceMeters: number;
  score: number;
  outcome: ShareCardOutcome;
  /** 正整數為名次、null 為已驗證但未進前 10 名、undefined 為尚未送出。 */
  leaderboardRank?: number | null;
  stageNumber?: number;
  totalStages?: number;
  stageName?: string | null;
}

interface ShareCardCopy {
  nickname: string;
  distanceValue: string;
  distanceUnit: '公里' | '公尺';
  score: string;
  outcomeBadge: string;
  stage: string;
  leaderboardText: string;
  rankValue: string;
  rankDetail: string;
}

/** Build the plain-text fallback used by Web Share or the clipboard. */
export function buildShareText(input: ShareCardInput): string {
  const copy = createShareCardCopy(input);
  const distance = `${copy.distanceValue} ${copy.distanceUnit}`;
  const outcome = input.outcome === 'completed' ? '完賽' : copy.stage;

  return [
    `${copy.nickname}在「${GAME_TITLE}」跑了 ${distance}！`,
    `分數 ${copy.score}｜${outcome}`,
    copy.leaderboardText,
    DISCLAIMER,
  ].join('\n');
}

/**
 * Render a 1080×1080 PNG using only browser-native Canvas primitives.
 * Unsupported or partially mocked browser APIs deliberately resolve to null.
 */
export async function createShareCardFile(input: ShareCardInput): Promise<File | null> {
  if (typeof document === 'undefined' || typeof File === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = SHARE_CARD_WIDTH;
    canvas.height = SHARE_CARD_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') return null;

    drawShareCard(context, createShareCardCopy(input));

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) return null;

    return new File([blob], 'marathon-finish-training-score.png', {
      type: 'image/png',
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
}

function createShareCardCopy(input: ShareCardInput): ShareCardCopy {
  const completed = input.outcome === 'completed';
  const nickname = normalizeText(input.nickname, '跑者', MAX_NICKNAME_LENGTH);
  const distanceMeters = normalizeNonNegativeInteger(input.distanceMeters);
  const score = formatInteger(normalizeNonNegativeInteger(input.score));
  const stageNumber = Math.max(1, normalizeNonNegativeInteger(input.stageNumber ?? 1));
  const totalStages = Math.max(stageNumber, normalizeNonNegativeInteger(input.totalStages ?? 3));
  const stageName = normalizeText(
    input.stageName,
    completed ? '正式比賽' : '基礎期',
    MAX_STAGE_NAME_LENGTH,
  );
  const leaderboardRank = normalizeLeaderboardRank(input.leaderboardRank);
  const leaderboard = createLeaderboardCopy(leaderboardRank);

  return {
    nickname,
    distanceValue: completed ? '42.195' : formatInteger(distanceMeters),
    distanceUnit: completed ? '公里' : '公尺',
    score,
    outcomeBadge: completed ? '完賽 FINISH' : '備賽紀錄',
    stage: completed
      ? `完成 ${totalStages} 關・${stageName}`
      : `抵達第 ${stageNumber} 關・${stageName}`,
    ...leaderboard,
  };
}

function drawShareCard(context: CanvasRenderingContext2D, copy: ShareCardCopy): void {
  const background = context.createLinearGradient(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  background.addColorStop(0, '#102a43');
  background.addColorStop(1, '#174f59');
  context.fillStyle = background;
  context.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  context.fillStyle = '#64d8c7';
  context.beginPath();
  context.arc(1_005, 75, 220, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f27d68';
  context.beginPath();
  context.arc(52, 1_030, 190, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawRouteLine(context);

  context.fillStyle = '#ffffff';
  context.font = font(48, 800);
  context.textAlign = 'left';
  context.fillText(GAME_TITLE, 72, 92);
  context.fillStyle = '#a8eee3';
  context.font = font(24, 700);
  context.fillText('循序累積・聰明恢復・一路跑完正式比賽', 74, 136);

  context.fillStyle = copy.outcomeBadge.startsWith('完賽') ? '#f27d68' : '#21a99a';
  fillRoundedRect(context, 770, 60, 238, 68, 34);
  context.fillStyle = '#ffffff';
  context.font = font(23, 800);
  context.textAlign = 'center';
  context.fillText(copy.outcomeBadge, 889, 103);

  context.fillStyle = '#ffffff';
  context.font = font(32, 700);
  context.textAlign = 'left';
  context.fillText(`跑者・${copy.nickname}`, 72, 220);

  drawDistanceCard(context, copy);
  drawCompactMetricCard(context, {
    x: 72,
    label: '本次分數',
    value: copy.score,
    detail: '分',
    accent: '#f27d68',
  });
  drawCompactMetricCard(context, {
    x: 558,
    label: '排行榜排名',
    value: copy.rankValue,
    detail: copy.rankDetail,
    accent: '#f4bf3f',
  });

  context.fillStyle = '#21a99a';
  fillRoundedRect(context, 72, 790, 936, 92, 24);
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.font = fittedFont(context, copy.stage, 29, 18, 600, 800);
  context.fillText(copy.stage, 108, 847);
  context.textAlign = 'right';
  context.font = font(20, 700);
  context.fillStyle = '#d9fff8';
  context.fillText('完賽比硬撐重要', 972, 846);

  context.textAlign = 'center';
  context.fillStyle = '#ffffff';
  context.font = font(27, 800);
  context.fillText('你能一路跑完正式比賽嗎？', SHARE_CARD_WIDTH / 2, 943);
  context.fillStyle = '#a8eee3';
  context.font = font(21, 700);
  context.fillText('marathongame.pages.dev', SHARE_CARD_WIDTH / 2, 980);

  context.textAlign = 'left';
  context.fillStyle = 'rgba(255,255,255,0.82)';
  context.font = font(17, 500);
  context.fillText(DISCLAIMER, 72, 1_032);
}

function drawRouteLine(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.22)';
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(734, 175);
  context.lineTo(806, 175);
  context.lineTo(852, 205);
  context.lineTo(930, 205);
  context.stroke();

  for (const [x, color] of [
    [734, '#64d8c7'],
    [852, '#ffffff'],
    [930, '#f27d68'],
  ] as const) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, x === 852 ? 205 : 175, 8, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawDistanceCard(context: CanvasRenderingContext2D, copy: ShareCardCopy): void {
  context.fillStyle = '#f7fbfc';
  fillRoundedRect(context, 72, 260, 936, 282, 30);
  context.fillStyle = '#21a99a';
  fillRoundedRect(context, 72, 260, 14, 282, 7);

  context.textAlign = 'left';
  context.fillStyle = '#466579';
  context.font = font(24, 700);
  context.fillText('本次里程', 116, 318);
  context.fillStyle = '#17324d';
  context.font = fittedFont(
    context,
    copy.distanceValue,
    copy.distanceValue.length > 7 ? 92 : 112,
    58,
    650,
    850,
  );
  context.fillText(copy.distanceValue, 116, 448);
  const valueWidth = context.measureText(copy.distanceValue).width;
  context.fillStyle = '#466579';
  context.font = font(31, 750);
  context.fillText(copy.distanceUnit, Math.min(880, 140 + valueWidth), 448);
  context.fillStyle = '#5c7282';
  context.font = font(20, 650);
  context.fillText('從基礎期、進階期到正式比賽', 116, 505);
}

function drawCompactMetricCard(
  context: CanvasRenderingContext2D,
  metric: { x: number; label: string; value: string; detail: string; accent: string },
): void {
  context.fillStyle = '#f7fbfc';
  fillRoundedRect(context, metric.x, 570, 450, 188, 26);
  context.fillStyle = metric.accent;
  fillRoundedRect(context, metric.x, 570, 12, 188, 6);

  context.textAlign = 'left';
  context.fillStyle = '#466579';
  context.font = font(22, 700);
  context.fillText(metric.label, metric.x + 40, 622);
  context.fillStyle = '#17324d';
  context.font = fittedFont(context, metric.value, metric.value.length > 8 ? 45 : 56, 36, 330, 850);
  context.fillText(metric.value, metric.x + 40, 698);
  context.fillStyle = '#466579';
  context.font = font(18, 700);
  context.textAlign = 'right';
  context.fillText(metric.detail, metric.x + 410, 724);
}

function createLeaderboardCopy(
  rank: number | null | undefined,
): Pick<ShareCardCopy, 'leaderboardText' | 'rankValue' | 'rankDetail'> {
  if (typeof rank === 'number') {
    const formattedRank = formatInteger(rank);
    return {
      leaderboardText: `排行榜第 ${formattedRank} 名`,
      rankValue: `#${formattedRank}`,
      rankDetail: '已通過伺服器驗證',
    };
  }
  if (rank === null) {
    return {
      leaderboardText: '成績已驗證・目前未進前 10 名',
      rankValue: 'TOP 10 外',
      rankDetail: '成績已通過驗證',
    };
  }
  return {
    leaderboardText: '排行榜：尚未送出',
    rankValue: '待驗證',
    rankDetail: '送出後顯示名次',
  };
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function normalizeText(
  value: string | null | undefined,
  fallback: string,
  maxLength: number,
): string {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const characters = Array.from(normalized || fallback);
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : characters.join('');
}

function normalizeNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_SHARE_VALUE, Math.max(0, Math.round(value))) : 0;
}

function normalizeLeaderboardRank(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (!Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? Math.min(MAX_SHARE_RANK, normalized) : null;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value);
}

function font(size: number, weight: number): string {
  return `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
}

function fittedFont(
  context: CanvasRenderingContext2D,
  text: string,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number,
  weight: number,
): string {
  context.font = font(preferredSize, weight);
  const measuredWidth = context.measureText(text).width;
  if (!Number.isFinite(measuredWidth) || measuredWidth <= maxWidth) {
    return context.font;
  }
  const fittedSize = Math.max(minimumSize, Math.floor((preferredSize * maxWidth) / measuredWidth));
  return font(fittedSize, weight);
}
