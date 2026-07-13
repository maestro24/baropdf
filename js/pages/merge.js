/** merge.html — PDF 합치기 */

import { setupDropzone, isPdfFile } from '../ui/dropzone.js';
import { createFileList } from '../ui/filelist.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { makeOutputName } from '../core/filename.js';
import { formatBytes } from '../core/format.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const listEl = document.getElementById('file-list');
const runBtn = document.getElementById('run-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let busy = false;

const list = createFileList(listEl, {
  reorder: true,
  onChange(files) {
    runBtn.disabled = files.length < 2 || busy;
    runBtn.textContent =
      files.length >= 2 ? `PDF ${files.length}개 합치기` : 'PDF 합치기 (2개 이상 선택)';
    resultEl.hidden = true;
  },
});

setupDropzone(zone, input, (files) => list.add(files), {
  accept: isPdfFile,
  acceptMessage: 'PDF 파일만 합칠 수 있습니다.',
  onReject: (msg) => progress.error(msg),
});

runBtn.addEventListener('click', async () => {
  const files = list.getFiles();
  if (files.length < 2 || busy) return;
  busy = true;
  runBtn.disabled = true;
  resultEl.hidden = true;
  progress.start('파일을 읽는 중…');

  try {
    const buffers = [];
    for (const f of files) buffers.push(await readFileBuffer(f));
    progress.update(0.05, 'PDF를 합치는 중…');

    const { bytes } = await runInWorker('merge', { buffers }, buffers, (r) =>
      progress.update(0.05 + r * 0.95),
    );

    progress.finish('완료! 다운로드를 시작합니다.');
    const name = makeOutputName(files[0].name, '합침');
    triggerDownload(bytes, name, 'application/pdf');
    showResult(name, bytes.byteLength, files.length);
  } catch (err) {
    progress.error(err.message ?? '합치기에 실패했습니다. 원본 파일은 그대로 보존됩니다.');
  } finally {
    busy = false;
    runBtn.disabled = list.getFiles().length < 2;
  }
});

function showResult(name, size, count) {
  resultEl.hidden = false;
  resultEl.querySelector('.result-meta').textContent =
    `PDF ${count}개 → ${name} (${formatBytes(size)})`;
}
