/**
 * 바로PDF Web Worker — 무거운 PDF 처리를 메인 스레드 밖에서 수행.
 * module worker로 로드된다: new Worker('worker.js', { type: 'module' })
 *
 * 요청:  { id, cmd, payload }
 * 응답:  { id, type: 'progress', value }        (0~1)
 *        { id, type: 'done', result }           (버퍼는 transferable로 전달)
 *        { id, type: 'error', message, code }
 */

import './vendor/pdf-lib.min.js'; // UMD — self.PDFLib 에 등록됨
import { mergePdfs } from './js/engine/merge.js';
import { extractPages, splitEveryPage } from './js/engine/split.js';
import { imagesToPdf } from './js/engine/images.js';
import { applyOrganize } from './js/engine/organize.js';
import { assembleJpegPdf, QUALITY_PRESETS } from './js/engine/compress.js';
import { renderPdfPages } from './js/engine/render.js';
import { toFriendlyMessage, MSG } from './js/engine/errors.js';

const PDFLib = self.PDFLib;
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('./vendor/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        './vendor/pdf.worker.min.mjs',
        self.location.href,
      ).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

const offscreenAdapter = {
  create(w, h) {
    return new OffscreenCanvas(w, h);
  },
  async encode(canvas, type, quality) {
    const blob = await canvas.convertToBlob({ type, quality });
    return blob.arrayBuffer();
  },
};

function hasOffscreen() {
  return typeof OffscreenCanvas !== 'undefined';
}

const handlers = {
  async inspect({ buffer }) {
    const doc = await PDFLib.PDFDocument.load(buffer);
    return { result: { pageCount: doc.getPageCount() }, transfer: [] };
  },

  async merge({ buffers }, progress) {
    const bytes = await mergePdfs(PDFLib, buffers, progress);
    return { result: { bytes }, transfer: [bytes.buffer] };
  },

  async extract({ buffer, pages }, progress) {
    const bytes = await extractPages(PDFLib, buffer, pages, progress);
    return { result: { bytes }, transfer: [bytes.buffer] };
  },

  async splitAll({ buffer }, progress) {
    const parts = await splitEveryPage(PDFLib, buffer, progress);
    return { result: { parts }, transfer: parts.map((p) => p.bytes.buffer) };
  },

  async imagesToPdf({ images, options }, progress) {
    const bytes = await imagesToPdf(PDFLib, images, options, progress);
    return { result: { bytes }, transfer: [bytes.buffer] };
  },

  async organize({ buffer, ops }, progress) {
    const bytes = await applyOrganize(PDFLib, buffer, ops, progress);
    return { result: { bytes }, transfer: [bytes.buffer] };
  },

  /** 렌더 (JPG 변환·썸네일) — OffscreenCanvas 필요 */
  async render({ buffer, options }, progress) {
    requireOffscreen();
    const pdfjs = await loadPdfjs();
    const pages = await renderPdfPages(pdfjs, buffer, options, offscreenAdapter, (d, t) =>
      progress(d / t),
    );
    return { result: { pages }, transfer: pages.map((p) => p.data) };
  },

  /** 압축 — 렌더(70%) + 재조립(30%) 을 한 번에 */
  async compress({ buffer, preset }, progress) {
    requireOffscreen();
    const conf = QUALITY_PRESETS[preset] ?? QUALITY_PRESETS.balanced;
    const pdfjs = await loadPdfjs();
    const rendered = await renderPdfPages(
      pdfjs,
      buffer,
      { scale: conf.scale, type: 'image/jpeg', quality: conf.jpeg },
      offscreenAdapter,
      (d, t) => progress((d / t) * 0.7),
    );
    const pages = rendered.map((p) => ({
      jpeg: p.data,
      widthPt: p.widthPt,
      heightPt: p.heightPt,
    }));
    const bytes = await assembleJpegPdf(PDFLib, pages, (r) => progress(0.7 + r * 0.3));
    return { result: { bytes, pageCount: pages.length }, transfer: [bytes.buffer] };
  },

  /** 메인 스레드에서 렌더링한 JPEG들을 PDF로 재조립 (OffscreenCanvas 미지원 폴백) */
  async assemble({ pages }, progress) {
    const bytes = await assembleJpegPdf(PDFLib, pages, progress);
    return { result: { bytes }, transfer: [bytes.buffer] };
  },
};

function requireOffscreen() {
  if (!hasOffscreen()) {
    const err = new Error('NO_OFFSCREEN');
    err.code = 'NO_OFFSCREEN';
    throw err;
  }
}

self.onmessage = async (event) => {
  const { id, cmd, payload } = event.data;
  const handler = handlers[cmd];
  if (!handler) {
    self.postMessage({ id, type: 'error', message: MSG.GENERIC, code: 'UNKNOWN_CMD' });
    return;
  }
  const progress = (value) => {
    self.postMessage({ id, type: 'progress', value: Math.min(1, Math.max(0, value)) });
  };
  try {
    const { result, transfer } = await handler(payload, progress);
    self.postMessage({ id, type: 'done', result }, transfer);
  } catch (err) {
    const code = err?.code === 'NO_OFFSCREEN' ? 'NO_OFFSCREEN' : 'FAIL';
    const message =
      code === 'NO_OFFSCREEN'
        ? '이 브라우저는 백그라운드 렌더링을 지원하지 않아 화면에서 직접 처리합니다.'
        : /페이지|필요|않습니다|없습니다|줄여/.test(String(err?.message))
          ? err.message
          : toFriendlyMessage(err);
    self.postMessage({ id, type: 'error', message, code });
  }
};
