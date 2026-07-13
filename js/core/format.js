/**
 * 표시용 포맷 유틸 — 순수 함수, DOM 의존 없음.
 */

/** 바이트 수를 사람이 읽기 좋은 문자열로. formatBytes(1536) → "1.5 KB" */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

/** 용량 절감률(%) — 음수(증가)면 0으로 내리지 않고 그대로 반환 */
export function savedPercent(before, after) {
  if (!(before > 0) || !Number.isFinite(after)) return 0;
  return Math.round(((before - after) / before) * 100);
}
