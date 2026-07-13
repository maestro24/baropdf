/** pdf-to-jpg.html — PDF를 JPG 이미지로 */

import { setupDropzone, isPdfFile } from '../ui/dropzone.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { renderPages } from '../ui/render-fallback.js';
import { pageFileName, makeOutputName } from '../core/filename.js';
import { formatBytes } from '../core/format.js';
import { buildZip } from '../core/zip.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const optionsCard = document.getElementById('options-card');
const dpiSelect = document.getElementById('dpi-select');
const runBtn = document.getElementById('run-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let currentFile = null;
let pageCount = 0;
let busy = false;

setupDropzone(zone, input, ([file]) => loadFile(file), {
  accept: isPdfFile,
  acceptMessage: 'PDF 파일만 변환할 수 있습니다.',
  onReject: (msg) => progress.error(msg),
});

async function loadFile(file) {
  progress.start('PDF를 확인하는 중…');
  resultEl.hidden = true;
  try {
    const buffer = await readFileBuffer(file);
    const { pageCount: count } = await runInWorker('inspect', { buffer }, [buffer]);
    currentFile = file;
    pageCount = count;
    fileInfo.hidden = false;
    fileInfo.textContent = `${file.name} — ${count}페이지 (${formatBytes(file.size)})`;
    optionsCard.hidden = false;
    runBtn.disabled = false;
    runBtn.textContent = count > 1 ? `JPG ${count}장으로 변환 (ZIP)` : 'JPG로 변환';
    progress.hide();
  } catch (err) {
    currentFile = null;
    optionsCard.hidden = true;
    fileInfo.hidden = true;
    progress.error(err.message);
  }
}

runBtn.addEventListener('click', async () => {
  if (!currentFile || busy) return;
  busy = true;
  runBtn.disabled = true;
  resultEl.hidden = true;
  progress.start('페이지를 이미지로 그리는 중…');

  try {
    const dpi = Number(dpiSelect.value) || 150;
    const scale = dpi / 72;
    const buffer = await readFileBuffer(currentFile);
    const pages = await renderPages(
      buffer,
      { scale, type: 'image/jpeg', quality: 0.92 },
      (r) => progress.update(r * 0.9),
    );

    if (pages.length === 1) {
      const name = pageFileName(currentFile.name, 1, 1, 'jpg');
      progress.finish('완료! 다운로드를 시작합니다.');
      triggerDownload(pages[0].data, name, 'image/jpeg');
      showResult(`${name} (${formatBytes(pages[0].data.byteLength)}, ${dpi} DPI)`);
    } else {
      progress.update(0.95, 'ZIP으로 묶는 중…');
      const entries = pages.map((p) => ({
        name: pageFileName(currentFile.name, p.page, pageCount, 'jpg'),
        data: new Uint8Array(p.data),
      }));
      const zip = buildZip(entries);
      const name = makeOutputName(currentFile.name, '이미지', 'zip');
      progress.finish('완료! 다운로드를 시작합니다.');
      triggerDownload(zip, name, 'application/zip');
      showResult(`${name} (${formatBytes(zip.byteLength)}, JPG ${pages.length}장, ${dpi} DPI)`);
    }
  } catch (err) {
    progress.error(err.message ?? '변환에 실패했습니다. 원본 파일은 그대로 보존됩니다.');
  } finally {
    busy = false;
    runBtn.disabled = !currentFile;
  }
});

function showResult(text) {
  resultEl.hidden = false;
  resultEl.querySelector('.result-meta').textContent = text;
}
