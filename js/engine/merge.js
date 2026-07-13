/**
 * PDF 합치기 엔진 — pdf-lib을 주입받아 사용 (Worker/Node 양쪽에서 동작).
 */

/**
 * @param {object} PDFLib  pdf-lib 네임스페이스
 * @param {ArrayBuffer[]|Uint8Array[]} buffers  합칠 PDF들 (순서대로)
 * @param {(ratio: number) => void} [onProgress]  0~1 진행률
 * @returns {Promise<Uint8Array>} 합쳐진 PDF 바이트
 */
export async function mergePdfs(PDFLib, buffers, onProgress = () => {}) {
  if (!Array.isArray(buffers) || buffers.length < 2) {
    throw new Error('합치려면 PDF가 2개 이상 필요합니다.');
  }

  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  const total = buffers.length;

  for (let i = 0; i < total; i += 1) {
    const src = await PDFDocument.load(buffers[i]);
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    for (const page of copied) merged.addPage(page);
    onProgress((i + 1) / (total + 1));
  }

  const bytes = await merged.save();
  onProgress(1);
  return bytes;
}
