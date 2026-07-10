export const SHARE_CARD_WIDTH = 1_200;
export const SHARE_CARD_HEIGHT = 630;

const GAME_TITLE = '馬拉松完賽訓練';
const DISCLAIMER = '本遊戲僅供一般運動衛教與娛樂，不作醫療診斷或個別建議。';
const MAX_NICKNAME_LENGTH = 16;
const MAX_STAGE_NAME_LENGTH = 14;

export type ShareCardOutcome = 'completed' | 'stopped';

export interface ShareCardInput {
  nickname?: string | null;
  distanceMeters: number;
  score: number;
  outcome: ShareCardOutcome;
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
}

/** Build the plain-text fallback used by Web Share or the clipboard. */
export function buildShareText(input: ShareCardInput): string {
  const copy = createShareCardCopy(input);
  const distance = `${copy.distanceValue} ${copy.distanceUnit}`;
  const outcome = input.outcome === 'completed' ? '完賽' : copy.stage;

  return [
    `${copy.nickname}在「${GAME_TITLE}」跑了 ${distance}！`,
    `分數 ${copy.score}｜${outcome}`,
    DISCLAIMER,
  ].join('\n');
}

/**
 * Render a 1200×630 PNG using only browser-native Canvas primitives.
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

  return {
    nickname,
    distanceValue: completed ? '42.195' : formatInteger(distanceMeters),
    distanceUnit: completed ? '公里' : '公尺',
    score,
    outcomeBadge: completed ? '完賽 FINISH' : '備賽紀錄',
    stage: completed
      ? `完成 ${totalStages} 關・${stageName}`
      : `抵達第 ${stageNumber} 關・${stageName}`,
  };
}

function drawShareCard(context: CanvasRenderingContext2D, copy: ShareCardCopy): void {
  const background = context.createLinearGradient(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  background.addColorStop(0, '#102a43');
  background.addColorStop(1, '#174f59');
  context.fillStyle = background;
  context.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = '#64d8c7';
  context.beginPath();
  context.arc(1_075, 45, 210, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f27d68';
  context.beginPath();
  context.arc(88, 610, 170, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawRouteLine(context);

  context.fillStyle = '#ffffff';
  context.font = font(46, 800);
  context.textAlign = 'left';
  context.fillText(GAME_TITLE, 76, 92);
  context.fillStyle = '#a8eee3';
  context.font = font(23, 700);
  context.fillText('三階段健康備賽・原創網頁遊戲', 78, 132);

  context.fillStyle = '#ffffff';
  context.font = font(31, 700);
  context.fillText(`跑者・${copy.nickname}`, 78, 202);

  context.fillStyle = copy.outcomeBadge.startsWith('完賽') ? '#f27d68' : '#21a99a';
  fillRoundedRect(context, 895, 65, 235, 60, 30);
  context.fillStyle = '#ffffff';
  context.font = font(22, 800);
  context.textAlign = 'center';
  context.fillText(copy.outcomeBadge, 1_012.5, 103);

  drawMetricCard(context, {
    x: 76,
    label: '本次里程',
    value: copy.distanceValue,
    unit: copy.distanceUnit,
    accent: '#21a99a',
  });
  drawMetricCard(context, {
    x: 618,
    label: '本次分數',
    value: copy.score,
    unit: '分',
    accent: '#f27d68',
  });

  context.fillStyle = '#21a99a';
  fillRoundedRect(context, 76, 452, 1_054, 74, 22);
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.font = font(28, 800);
  context.fillText(copy.stage, 112, 499);
  context.textAlign = 'right';
  context.font = font(19, 700);
  context.fillStyle = '#d9fff8';
  context.fillText('循序累積・重視恢復・量力而為', 1_094, 498);

  context.textAlign = 'left';
  context.fillStyle = 'rgba(255,255,255,0.82)';
  context.font = font(17, 500);
  context.fillText(DISCLAIMER, 78, 580);
}

function drawRouteLine(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.22)';
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(665, 169);
  context.lineTo(755, 169);
  context.lineTo(807, 203);
  context.lineTo(878, 203);
  context.stroke();

  for (const [x, color] of [
    [665, '#64d8c7'],
    [807, '#ffffff'],
    [878, '#f27d68'],
  ] as const) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, x === 807 ? 203 : 169, 8, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMetricCard(
  context: CanvasRenderingContext2D,
  metric: { x: number; label: string; value: string; unit: string; accent: string },
): void {
  context.fillStyle = '#f7fbfc';
  fillRoundedRect(context, metric.x, 238, 506, 176, 24);
  context.fillStyle = metric.accent;
  fillRoundedRect(context, metric.x, 238, 11, 176, 5.5);

  context.textAlign = 'left';
  context.fillStyle = '#466579';
  context.font = font(22, 700);
  context.fillText(metric.label, metric.x + 38, 284);
  context.fillStyle = '#17324d';
  context.font = font(metric.value.length > 7 ? 52 : 62, 800);
  context.fillText(metric.value, metric.x + 38, 365);
  const valueWidth = context.measureText(metric.value).width;
  context.fillStyle = '#466579';
  context.font = font(23, 700);
  context.fillText(metric.unit, metric.x + 50 + valueWidth, 365);
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
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value);
}

function font(size: number, weight: number): string {
  return `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
}
