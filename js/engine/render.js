/**
 * pdf.js 렌더링 엔진 — 캔버스 팩토리를 주입받아 Worker(OffscreenCanvas)와
 * 메인 스레드(canvas 엘리먼트) 양쪽에서 동작한다.
 */

/**
 * @typedef {object} CanvasAdapter
 * @property {(w: number, h: number) => any} create  캔버스 생성
 * @property {(canvas: any, type: string, quality: number) => Promise<ArrayBuffer>} encode
 */

/**
 * PDF 페이지들을 이미지로 렌더링한다.
 * @param {object} pdfjsLib  pdf.js 네임스페이스 (GlobalWorkerOptions 설정 완료 상태)
 * @param {ArrayBuffer|Uint8Array} buffer  PDF 바이트
 * @param {{ scale?: number, targetWidth?: number, pages?: number[], type?: string, quality?: number, maxDim?: number }} options
 *   pages 미지정 시 전체. type 기본 image/jpeg. targetWidth 지정 시 페이지별 배율 자동 계산(썸네일용).
 * @param {CanvasAdapter} adapter
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Array<{ page: number, data: ArrayBuffer, width: number, height: number, widthPt: number, heightPt: number }>>}
 */
export async function renderPdfPages(pdfjsLib, buffer, options, adapter, onProgress = () => {}) {
  const scale = options.scale ?? 1.5;
  const type = options.type ?? 'image/jpeg';
  const quality = options.quality ?? 0.85;
  const maxDim = options.maxDim ?? 8192;

  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;

  try {
    const total = doc.numPages;
    const pageNumbers =
      options.pages && options.pages.length > 0
        ? options.pages
        : Array.from({ length: total }, (_, i) => i + 1);

    const results = [];
    let done = 0;
    for (const pageNo of pageNumbers) {
      if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > total) {
        throw new Error(`${pageNo}페이지는 없습니다. 이 문서는 ${total}페이지입니다.`);
      }
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const wanted = options.targetWidth ? options.targetWidth / base.width : scale;
      const safeScale = Math.min(wanted, maxDim / base.width, maxDim / base.height);
      const viewport = page.getViewport({ scale: safeScale });
      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));

      const canvas = adapter.create(width, height);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const encoded = await adapter.encode(canvas, type, quality);
      results.push({
        page: pageNo,
        data: encoded,
        width,
        height,
        widthPt: base.width,
        heightPt: base.height,
      });
      page.cleanup();
      done += 1;
      onProgress(done, pageNumbers.length);
    }
    return results;
  } finally {
    await doc.destroy();
  }
}
