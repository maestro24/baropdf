/**
 * 이미지 → PDF 엔진 — pdf-lib 주입식 (Worker/Node 양쪽에서 동작).
 */

import { computePlacement } from '../core/paper.js';

/**
 * @param {object} PDFLib
 * @param {Array<{ bytes: ArrayBuffer|Uint8Array, type: 'jpg'|'png' }>} images
 * @param {{ paper?: 'a4'|'letter'|'fit', marginMm?: number }} options
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function imagesToPdf(PDFLib, images, options = {}, onProgress = () => {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('변환할 이미지가 없습니다.');
  }
  const paper = options.paper ?? 'a4';
  const marginMm = options.marginMm ?? 0;

  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();

  for (let i = 0; i < images.length; i += 1) {
    const { bytes, type } = images[i];
    const embedded =
      type === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const place = computePlacement(embedded.width, embedded.height, paper, marginMm);
    const page = doc.addPage([place.pageWidth, place.pageHeight]);
    page.drawImage(embedded, {
      x: place.x,
      y: place.y,
      width: place.drawWidth,
      height: place.drawHeight,
    });
    onProgress((i + 1) / (images.length + 1));
  }

  const out = await doc.save();
  onProgress(1);
  return out;
}
