/**
 * 출력 파일명 생성 유틸 — 순수 함수, DOM 의존 없음.
 */

const INVALID_CHARS = new RegExp('[\\\\/:*?"<>|\\u0000-\\u001f]', 'g');

/** 확장자를 제거한 기본 이름을 돌려준다. */
export function baseName(filename) {
  if (typeof filename !== 'string' || filename === '') return 'document';
  const withoutPath = filename.split(/[\\/]/).pop();
  const dot = withoutPath.lastIndexOf('.');
  const base = dot > 0 ? withoutPath.slice(0, dot) : withoutPath;
  const cleaned = base.replace(INVALID_CHARS, '_').trim();
  return cleaned === '' ? 'document' : cleaned;
}

/**
 * 도구 접미사가 붙은 출력 파일명을 만든다.
 * makeOutputName("보고서.pdf", "합침") → "보고서_합침.pdf"
 */
export function makeOutputName(sourceName, suffix, ext = 'pdf') {
  const base = baseName(sourceName);
  const safeSuffix = String(suffix ?? '').replace(INVALID_CHARS, '_');
  const name = safeSuffix ? `${base}_${safeSuffix}` : base;
  return `${name}.${ext}`;
}

/**
 * 페이지 번호가 붙은 파일명 (ZIP 내부 항목, 개별 분할 등).
 * pageFileName("보고서.pdf", 3, 12, "jpg") → "보고서_03.jpg" (총량 자릿수만큼 0 채움)
 */
export function pageFileName(sourceName, pageNumber, totalPages, ext) {
  const base = baseName(sourceName);
  const width = Math.max(2, String(totalPages).length);
  const num = String(pageNumber).padStart(width, '0');
  return `${base}_${num}.${ext}`;
}
