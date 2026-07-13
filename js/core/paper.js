/**
 * 용지 크기 계산 — mm → pt 변환, 이미지 배치 계산.
 * 순수 함수, DOM 의존 없음.
 */

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

/** 밀리미터 → PDF 포인트 */
export function mmToPt(mm) {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

/** 지원 용지 (pt 단위, 세로 방향 기준) */
export const PAPER_SIZES = Object.freeze({
  a4: Object.freeze({ width: mmToPt(210), height: mmToPt(297), label: 'A4' }),
  letter: Object.freeze({ width: 612, height: 792, label: 'Letter' }),
});

/**
 * 이미지를 페이지에 맞춰 배치한다 (비율 유지, 가운데 정렬).
 * @param {number} imgW 이미지 너비(px 또는 pt — 비율만 사용)
 * @param {number} imgH 이미지 높이
 * @param {'a4'|'letter'|'fit'} paper  'fit'이면 이미지 크기 그대로 페이지 생성
 * @param {number} marginMm 여백(mm)
 * @param {boolean} autoRotate 가로 이미지는 가로 용지로 자동 회전
 * @returns {{ pageWidth, pageHeight, x, y, drawWidth, drawHeight }}
 */
export function computePlacement(imgW, imgH, paper, marginMm = 0, autoRotate = true) {
  if (!(imgW > 0) || !(imgH > 0)) {
    throw new Error('이미지 크기가 올바르지 않습니다.');
  }
  const margin = mmToPt(Math.max(0, marginMm));

  if (paper === 'fit') {
    // 이미지 px을 72dpi pt로 취급 + 여백
    const pageWidth = imgW + margin * 2;
    const pageHeight = imgH + margin * 2;
    return {
      pageWidth,
      pageHeight,
      x: margin,
      y: margin,
      drawWidth: imgW,
      drawHeight: imgH,
    };
  }

  const size = PAPER_SIZES[paper];
  if (!size) {
    throw new Error(`지원하지 않는 용지입니다: ${paper}`);
  }

  const landscape = autoRotate && imgW > imgH;
  const pageWidth = landscape ? size.height : size.width;
  const pageHeight = landscape ? size.width : size.height;

  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2;
  if (availW <= 0 || availH <= 0) {
    throw new Error('여백이 너무 큽니다. 여백을 줄여 주세요.');
  }

  const scale = Math.min(availW / imgW, availH / imgH);
  const drawWidth = imgW * scale;
  const drawHeight = imgH * scale;

  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}
