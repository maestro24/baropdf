/**
 * PDF 분할/추출 엔진 — pdf-lib 주입식 (Worker/Node 양쪽에서 동작).
 */

/**
 * 지정한 페이지들만 뽑아 새 PDF를 만든다.
 * @param {object} PDFLib
 * @param {ArrayBuffer|Uint8Array} buffer 원본 PDF
 * @param {number[]} pages 1-기반 페이지 번호 (입력 순서 보존, 중복 허용)
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function extractPages(PDFLib, buffer, pages, onProgress = () => {}) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('추출할 페이지가 없습니다.');
  }
  const { PDFDocument } = PDFLib;
  const src = await PDFDocument.load(buffer);
  const total = src.getPageCount();
  for (const p of pages) {
    if (!Number.isInteger(p) || p < 1 || p > total) {
      throw new Error(`${p}페이지는 없습니다. 이 문서는 ${total}페이지입니다.`);
    }
  }

  const out = await PDFDocument.create();
  const indices = pages.map((p) => p - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((page, i) => {
    out.addPage(page);
    onProgress((i + 1) / (copied.length + 1));
  });
  const bytes = await out.save();
  onProgress(1);
  return bytes;
}

/**
 * 모든 페이지를 1페이지짜리 PDF들로 분할한다.
 * @returns {Promise<Array<{ page: number, bytes: Uint8Array }>>}
 */
export async function splitEveryPage(PDFLib, buffer, onProgress = () => {}) {
  const { PDFDocument } = PDFLib;
  const src = await PDFDocument.load(buffer);
  const total = src.getPageCount();
  if (total < 2) {
    throw new Error('이 PDF는 1페이지뿐이라 분할할 필요가 없습니다.');
  }

  const results = [];
  for (let i = 0; i < total; i += 1) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    results.push({ page: i + 1, bytes: await out.save() });
    onProgress((i + 1) / total);
  }
  return results;
}
