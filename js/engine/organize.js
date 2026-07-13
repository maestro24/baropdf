/**
 * 페이지 정리 엔진 (순서 변경·회전·삭제) — pdf-lib 주입식.
 */

/**
 * @param {object} PDFLib
 * @param {ArrayBuffer|Uint8Array} buffer 원본 PDF
 * @param {Array<{ srcIndex: number, rotation: number }>} ops
 *   최종 페이지 순서. srcIndex는 0-기반 원본 인덱스, rotation은 추가 회전(90도 단위).
 *   목록에 없는 원본 페이지는 삭제된 것으로 간주.
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function applyOrganize(PDFLib, buffer, ops, onProgress = () => {}) {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error('남은 페이지가 없습니다. 최소 1페이지는 있어야 합니다.');
  }
  const { PDFDocument, degrees } = PDFLib;
  const src = await PDFDocument.load(buffer);
  const total = src.getPageCount();

  for (const op of ops) {
    if (!Number.isInteger(op.srcIndex) || op.srcIndex < 0 || op.srcIndex >= total) {
      throw new Error('페이지 정보가 올바르지 않습니다. 파일을 다시 불러와 주세요.');
    }
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    ops.map((op) => op.srcIndex),
  );

  copied.forEach((page, i) => {
    const extra = ((ops[i].rotation % 360) + 360) % 360;
    if (extra !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + extra) % 360));
    }
    out.addPage(page);
    onProgress((i + 1) / (copied.length + 1));
  });

  const bytes = await out.save();
  onProgress(1);
  return bytes;
}
