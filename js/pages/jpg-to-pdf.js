/** jpg-to-pdf.html — 사진(JPG/PNG)을 PDF로 */

import { setupDropzone, isImageFile, imageType } from '../ui/dropzone.js';
import { createFileList } from '../ui/filelist.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { makeOutputName } from '../core/filename.js';
import { formatBytes } from '../core/format.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const listEl = document.getElementById('file-list');
const paperSelect = document.getElementById('paper-select');
const marginSelect = document.getElementById('margin-select');
const runBtn = document.getElementById('run-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let busy = false;

const list = createFileList(listEl, {
  reorder: true,
  onChange(files) {
    runBtn.disabled = files.length === 0 || busy;
    runBtn.textContent =
      files.length > 0 ? `사진 ${files.length}장을 PDF로 만들기` : 'PDF 만들기 (사진 선택)';
    resultEl.hidden = true;
  },
});

setupDropzone(zone, input, (files) => list.add(files), {
  accept: isImageFile,
  acceptMessage: 'JPG 또는 PNG 이미지만 지원합니다.',
  onReject: (msg) => progress.error(msg),
});

runBtn.addEventListener('click', async () => {
  const files = list.getFiles();
  if (files.length === 0 || busy) return;
  busy = true;
  runBtn.disabled = true;
  resultEl.hidden = true;
  progress.start('사진을 읽는 중…');

  try {
    const images = [];
    for (const f of files) {
      images.push({ bytes: await readFileBuffer(f), type: imageType(f) });
    }
    progress.update(0.05, 'PDF를 만드는 중…');

    const options = {
      paper: paperSelect.value,
      marginMm: Number(marginSelect.value) || 0,
    };
    const { bytes } = await runInWorker(
      'imagesToPdf',
      { images, options },
      images.map((im) => im.bytes),
      (r) => progress.update(0.05 + r * 0.95),
    );

    const name = makeOutputName(files.length === 1 ? files[0].name : '사진모음', '문서');
    progress.finish('완료! 다운로드를 시작합니다.');
    triggerDownload(bytes, name, 'application/pdf');
    resultEl.hidden = false;
    resultEl.querySelector('.result-meta').textContent =
      `사진 ${files.length}장 → ${name} (${formatBytes(bytes.byteLength)})`;
  } catch (err) {
    progress.error(err.message ?? '변환에 실패했습니다. 원본 사진은 그대로 보존됩니다.');
  } finally {
    busy = false;
    runBtn.disabled = list.getFiles().length === 0;
  }
});
