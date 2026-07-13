/**
 * 결과 다운로드 헬퍼.
 */

/**
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {string} filename
 * @param {string} [mime]
 */
export function triggerDownload(bytes, filename, mime = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** File → ArrayBuffer (실패 시 한국어 에러) */
export async function readFileBuffer(file) {
  try {
    return await file.arrayBuffer();
  } catch {
    throw new Error(`"${file.name}" 파일을 읽지 못했습니다. 파일이 이동/삭제되지 않았는지 확인해 주세요.`);
  }
}
