/**
 * 렌더링 서비스 — OffscreenCanvas를 지원하면 Worker에서,
 * 아니면 메인 스레드(pdf.js 자체 워커가 파싱 담당)에서 렌더링한다.
 */

import { renderPdfPages } from '../engine/render.js';
import { runInWorker } from './worker-client.js';

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../../vendor/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        '../../vendor/pdf.worker.min.mjs',
        import.meta.url,
      ).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

const domAdapter = {
  create(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  },
  encode(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 인코딩에 실패했습니다.'));
            return;
          }
          blob.arrayBuffer().then(resolve, reject);
        },
        type,
        quality,
      );
    });
  },
};

export function workerRenderSupported() {
  return typeof OffscreenCanvas !== 'undefined';
}

/**
 * PDF 페이지를 이미지로 렌더링 (Worker 우선, 자동 폴백).
 * @param {ArrayBuffer} buffer  전용 사본 (호출 후 재사용 금지 — transfer될 수 있음)
 * @param {object} options  renderPdfPages 옵션
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<Array<{ page, data, width, height, widthPt, heightPt }>>}
 */
export async function renderPages(buffer, options, onProgress = () => {}) {
  if (workerRenderSupported()) {
    const { pages } = await runInWorker('render', { buffer, options }, [buffer], onProgress);
    return pages;
  }
  const pdfjs = await loadPdfjs();
  return renderPdfPages(pdfjs, buffer, options, domAdapter, (d, t) => onProgress(d / t));
}
