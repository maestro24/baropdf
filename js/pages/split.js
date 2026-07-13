/** split.html — PDF 분할/추출 */

import { setupDropzone, isPdfFile } from '../ui/dropzone.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { parseRanges, uniqueSorted } from '../core/range-parser.js';
import { makeOutputName, pageFileName } from '../core/filename.js';
import { formatBytes } from '../core/format.js';
import { buildZip } from '../core/zip.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const optionsCard = document.getElementById('options-card');
const rangeInput = document.getElementById('range-input');
const rangePreview = document.getElementById('range-preview');
const modeButtons = Array.from(document.querySelectorAll('.seg button'));
const rangeField = document.getElementById('range-field');
const runBtn = document.getElementById('run-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let currentFile = null;
let pageCount = 0;
let mode = 'extract';
let busy = false;

setupDropzone(zone, input, ([file]) => loadFile(file), {
  accept: isPdfFile,
  acceptMessage: 'PDF 파일만 분할할 수 있습니다.',
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
    fileInfo.textContent = `${file.name} — 총 ${count}페이지 (${formatBytes(file.size)})`;
    optionsCard.hidden = false;
    rangeInput.placeholder = `예: 1-3,5,7-  (1~${count})`;
    progress.hide();
    updateState();
  } catch (err) {
    currentFile = null;
    optionsCard.hidden = true;
    fileInfo.hidden = true;
    progress.error(err.message);
  }
}

for (const btn of modeButtons) {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    for (const b of modeButtons) b.setAttribute('aria-pressed', String(b === btn));
    rangeField.hidden = mode !== 'extract';
    updateState();
  });
}

rangeInput.addEventListener('input', updateState);

function updateState() {
  if (!currentFile) {
    runBtn.disabled = true;
    return;
  }
  if (mode === 'each') {
    rangePreview.textContent = `모든 페이지를 1페이지짜리 PDF ${pageCount}개로 나눠 ZIP으로 내려받습니다.`;
    rangePreview.classList.remove('is-bad');
    runBtn.disabled = busy || pageCount < 2;
    runBtn.textContent = 'PDF 분할하기';
    if (pageCount < 2) rangePreview.textContent = '이 PDF는 1페이지뿐이라 분할할 필요가 없습니다.';
    return;
  }
  runBtn.textContent = '페이지 추출하기';
  const parsed = parseRanges(rangeInput.value, pageCount);
  if (!parsed.ok) {
    rangePreview.textContent = rangeInput.value.trim() === '' ? '' : parsed.error;
    rangePreview.classList.add('is-bad');
    runBtn.disabled = true;
    return;
  }
  rangePreview.textContent = `${parsed.pages.length}페이지 추출: ${summarize(parsed.pages)}`;
  rangePreview.classList.remove('is-bad');
  runBtn.disabled = busy;
}

function summarize(pages) {
  const uniq = uniqueSorted(pages);
  const shown = uniq.slice(0, 12).join(', ');
  return uniq.length > 12 ? `${shown} …` : shown;
}

runBtn.addEventListener('click', async () => {
  if (!currentFile || busy) return;
  busy = true;
  runBtn.disabled = true;
  resultEl.hidden = true;

  try {
    const buffer = await readFileBuffer(currentFile);
    if (mode === 'extract') {
      const parsed = parseRanges(rangeInput.value, pageCount);
      if (!parsed.ok) throw new Error(parsed.error);
      progress.start('페이지를 추출하는 중…');
      const { bytes } = await runInWorker(
        'extract',
        { buffer, pages: parsed.pages },
        [buffer],
        (r) => progress.update(r),
      );
      const name = makeOutputName(currentFile.name, '추출');
      progress.finish('완료! 다운로드를 시작합니다.');
      triggerDownload(bytes, name, 'application/pdf');
      showResult(`${name} (${formatBytes(bytes.byteLength)}, ${parsed.pages.length}페이지)`);
    } else {
      progress.start('페이지를 나누는 중…');
      const { parts } = await runInWorker('splitAll', { buffer }, [buffer], (r) =>
        progress.update(r * 0.9),
      );
      progress.update(0.95, 'ZIP으로 묶는 중…');
      const entries = parts.map((p) => ({
        name: pageFileName(currentFile.name, p.page, pageCount, 'pdf'),
        data: p.bytes instanceof Uint8Array ? p.bytes : new Uint8Array(p.bytes),
      }));
      const zip = buildZip(entries);
      const name = makeOutputName(currentFile.name, '분할', 'zip');
      progress.finish('완료! 다운로드를 시작합니다.');
      triggerDownload(zip, name, 'application/zip');
      showResult(`${name} (${formatBytes(zip.byteLength)}, PDF ${parts.length}개)`);
    }
  } catch (err) {
    progress.error(err.message ?? '분할에 실패했습니다. 원본 파일은 그대로 보존됩니다.');
  } finally {
    busy = false;
    updateState();
  }
});

function showResult(text) {
  resultEl.hidden = false;
  resultEl.querySelector('.result-meta').textContent = text;
}
