/**
 * 드롭존 — 클릭·드래그앤드롭으로 파일을 받는다.
 */

/**
 * @param {HTMLElement} zone  드롭존 요소 (.dropzone)
 * @param {HTMLInputElement} input  숨겨진 <input type="file">
 * @param {(files: File[]) => void} onFiles
 * @param {{ accept?: (file: File) => boolean, acceptMessage?: string, onReject?: (msg: string) => void }} [opts]
 */
export function setupDropzone(zone, input, onFiles, opts = {}) {
  const accept = opts.accept ?? (() => true);
  const acceptMessage = opts.acceptMessage ?? '지원하지 않는 파일 형식입니다.';
  const onReject = opts.onReject ?? (() => {});

  const handle = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const good = files.filter(accept);
    const bad = files.length - good.length;
    if (bad > 0) onReject(`${bad}개 파일 제외: ${acceptMessage}`);
    if (good.length > 0) onFiles(good);
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    handle(input.files);
    input.value = '';
  });

  for (const evt of ['dragenter', 'dragover']) {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
  }
  for (const evt of ['dragleave', 'drop']) {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');
    });
  }
  zone.addEventListener('drop', (e) => handle(e.dataTransfer?.files));
}

/** 확장자·MIME 기반 수용 판정 헬퍼 */
export const isPdfFile = (file) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

export const isImageFile = (file) =>
  /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);

/** 이미지 파일의 종류('jpg'|'png')를 돌려준다. */
export function imageType(file) {
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'png';
  return 'jpg';
}
