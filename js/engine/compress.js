/**
 * PDF 압축 엔진 (재조립 단계) — 렌더링된 JPEG 페이지들을 pdf-lib으로 새 PDF에 담는다.
 * pdf-lib 주입식 (Worker/Node 양쪽에서 동작).
 */

/** 품질 프리셋: 렌더 배율(원본 pt 대비)과 JPEG 품질 */
export const QUALITY_PRESETS = Object.freeze({
  high: Object.freeze({ label: '고화질', scale: 2.0, jpeg: 0.85 }),
  balanced: Object.freeze({ label: '균형', scale: 1.5, jpeg: 0.7 }),
  small: Object.freeze({ label: '최대 압축', scale: 1.0, jpeg: 0.5 }),
});

/**
 * @param {object} PDFLib
 * @param {Array<{ jpeg: ArrayBuffer|Uint8Array, widthPt: number, heightPt: number }>} pages
 *   각 페이지의 JPEG 바이트와 원본 페이지 크기(pt)
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function assembleJpegPdf(PDFLib, pages, onProgress = () => {}) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('압축할 페이지가 없습니다.');
  }
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i += 1) {
    const { jpeg, widthPt, heightPt } = pages[i];
    if (!(widthPt > 0) || !(heightPt > 0)) {
      throw new Error('페이지 크기 정보가 올바르지 않습니다.');
    }
    const img = await doc.embedJpg(jpeg);
    const page = doc.addPage([widthPt, heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
    onProgress((i + 1) / (pages.length + 1));
  }

  const bytes = await doc.save();
  onProgress(1);
  return bytes;
}
