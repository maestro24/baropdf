/** compress.html — PDF 용량 줄이기 */

import { setupDropzone, isPdfFile } from '../ui/dropzone.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { renderPages, workerRenderSupported } from '../ui/render-fallback.js';
import { QUALITY_PRESETS } from '../engine/compress.js';
import { makeOutputName } from '../core/filename.js';
import { formatBytes, savedPercent } from '../core/format.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const optionsCard = document.getElementById('options-card');
const presetButtons = Array.from(document.querySelectorAll('.seg button'));
const runBtn = document.getElementById('run-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let currentFile = null;
let preset = 'balanced';
let busy = false;

setupDropzone(zone, input, ([file]) => loadFile(file), {
  accept: isPdfFile,
  acceptMessage: 'PDF 파일만 압축할 수 있습니다.',
  onReject: (msg) => progress.error(msg),
});

async function loadFile(file) {
  progress.start('PDF를 확인하는 중…');
  resultEl.hidden = true;
  try {
    const buffer = await readFileBuffer(file);
    const { pageCount } = await runInWorker('inspect', { buffer }, [buffer]);
    currentFile = file;
    fileInfo.hidden = false;
    fileInfo.textContent = `${file.name} — ${pageCount}페이지, 현재 ${formatBytes(file.size)}`;
    optionsCard.hidden = false;
    runBtn.disabled = false;
    progress.hide();
  } catch (err) {
    currentFile = null;
    optionsCard.hidden = true;
    fileInfo.hidden = true;
    progress.error(err.message);
  }
}

for (const btn of presetButtons) {
  btn.addEventListener('click', () => {
    preset = btn.dataset.preset;
    for (const b of presetButtons) b.setAttribute('aria-pressed', String(b === btn));
  });
}

runBtn.addEventListener('click', async () => {
  if (!currentFile || busy) return;
  busy = true;
  runBtn.disabled = true;
  resultEl.hidden = true;
  progress.start('페이지를 다시 그리는 중…');

  try {
    const before = currentFile.size;
    const buffer = await readFileBuffer(currentFile);
    let bytes;

    if (workerRenderSupported()) {
      ({ bytes } = await runInWorker('compress', { buffer, preset }, [buffer], (r) =>
        progress.update(r, r < 0.7 ? '페이지를 다시 그리는 중…' : 'PDF로 재조립하는 중…'),
      ));
    } else {
      const conf = QUALITY_PRESETS[preset] ?? QUALITY_PRESETS.balanced;
      const rendered = await renderPages(
        buffer,
        { scale: conf.scale, type: 'image/jpeg', quality: conf.jpeg },
        (r) => progress.update(r * 0.7),
      );
      const pages = rendered.map((p) => ({
        jpeg: p.data,
        widthPt: p.widthPt,
        heightPt: p.heightPt,
      }));
      ({ bytes } = await runInWorker(
        'assemble',
        { pages },
        pages.map((p) => p.jpeg),
        (r) => progress.update(0.7 + r * 0.3, 'PDF로 재조립하는 중…'),
      ));
    }

    const after = bytes.byteLength;
    const name = makeOutputName(currentFile.name, '압축');
    progress.finish('완료! 다운로드를 시작합니다.');
    triggerDownload(bytes, name, 'application/pdf');
    showResult(before, after, name);
  } catch (err) {
    progress.error(err.message ?? '압축에 실패했습니다. 원본 파일은 그대로 보존됩니다.');
  } finally {
    busy = false;
    runBtn.disabled = !currentFile;
  }
});

function showResult(before, after, name) {
  resultEl.hidden = false;
  resultEl.querySelector('.before').textContent = formatBytes(before);
  resultEl.querySelector('.after').textContent = formatBytes(after);
  const saved = savedPercent(before, after);
  const savedEl = resultEl.querySelector('.saved');
  savedEl.textContent = saved > 0 ? `-${saved}%` : '변화 없음';
  resultEl.querySelector('.result-meta').textContent =
    saved > 0
      ? `${name} 다운로드 완료`
      : '이미 최적화된 PDF라 더 줄지 않았습니다. 원본 사용을 권장합니다.';
}
