/** organize.html — 페이지 순서 변경·회전·삭제 */

import { setupDropzone, isPdfFile } from '../ui/dropzone.js';
import { createProgress } from '../ui/progress.js';
import { triggerDownload, readFileBuffer } from '../ui/download.js';
import { runInWorker } from '../ui/worker-client.js';
import { renderPages } from '../ui/render-fallback.js';
import { makeOutputName } from '../core/filename.js';
import { formatBytes } from '../core/format.js';

const zone = document.getElementById('dropzone');
const input = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const grid = document.getElementById('thumb-grid');
const toolbar = document.getElementById('organize-toolbar');
const saveBtn = document.getElementById('run-btn');
const resetBtn = document.getElementById('reset-btn');
const progress = createProgress(document.getElementById('progress'));
const resultEl = document.getElementById('result');

let currentFile = null;
/** @type {Array<{ srcIndex: number, rotation: number, url: string }>} — 불변 갱신 */
let cells = [];
let dragFrom = -1;
let busy = false;

setupDropzone(zone, input, ([file]) => loadFile(file), {
  accept: isPdfFile,
  acceptMessage: 'PDF 파일만 열 수 있습니다.',
  onReject: (msg) => progress.error(msg),
});

async function loadFile(file) {
  progress.start('페이지 미리보기를 만드는 중…');
  resultEl.hidden = true;
  releaseThumbs();
  setCells([]);
  try {
    const buffer = await readFileBuffer(file);
    const pages = await renderPages(
      buffer,
      { targetWidth: 300, type: 'image/jpeg', quality: 0.8 },
      (r) => progress.update(r),
    );
    currentFile = file;
    setCells(
      pages.map((p) => ({
        srcIndex: p.page - 1,
        rotation: 0,
        url: URL.createObjectURL(new Blob([p.data], { type: 'image/jpeg' })),
      })),
    );
    fileInfo.hidden = false;
    fileInfo.textContent = `${file.name} — ${pages.length}페이지 (${formatBytes(file.size)}) · 썸네일을 드래그해 순서를 바꾸세요.`;
    toolbar.hidden = false;
    progress.hide();
  } catch (err) {
    currentFile = null;
    toolbar.hidden = true;
    fileInfo.hidden = true;
    progress.error(err.message);
  }
}

function setCells(next) {
  cells = next;
  renderGrid();
  saveBtn.disabled = busy || !currentFile || cells.length === 0;
}

function releaseThumbs() {
  for (const c of cells) URL.revokeObjectURL(c.url);
}

function renderGrid() {
  grid.textContent = '';
  cells.forEach((cell, i) => {
    const li = document.createElement('li');
    li.className = 'thumb-cell';
    li.draggable = true;
    li.addEventListener('dragstart', () => {
      dragFrom = i;
      li.classList.add('is-dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('is-dragging'));
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('is-dropover');
    });
    li.addEventListener('dragleave', () => li.classList.remove('is-dropover'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('is-dropover');
      if (dragFrom >= 0 && dragFrom !== i) {
        const next = [...cells];
        const [moved] = next.splice(dragFrom, 1);
        next.splice(i, 0, moved);
        setCells(next);
      }
      dragFrom = -1;
    });

    const wrap = document.createElement('div');
    wrap.className = 'thumb-img-wrap';
    const img = document.createElement('img');
    img.src = cell.url;
    img.alt = `${cell.srcIndex + 1}페이지 미리보기`;
    img.style.transform = `rotate(${cell.rotation}deg)`;
    img.draggable = false;
    wrap.append(img);

    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = `${i + 1} (원본 ${cell.srcIndex + 1}p)`;

    const tools = document.createElement('div');
    tools.className = 'thumb-tools';
    tools.append(
      tinyBtn('⟲', '왼쪽으로 회전', () => rotate(i, -90)),
      tinyBtn('⟳', '오른쪽으로 회전', () => rotate(i, 90)),
      tinyBtn('✕', '페이지 삭제', () => remove(i)),
    );

    li.append(wrap, num, tools);
    grid.append(li);
  });
}

function tinyBtn(text, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.textContent = text;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', onClick);
  return btn;
}

function rotate(i, delta) {
  setCells(
    cells.map((c, j) =>
      j === i ? { ...c, rotation: (((c.rotation + delta) % 360) + 360) % 360 } : c,
    ),
  );
}

function remove(i) {
  URL.revokeObjectURL(cells[i].url);
  setCells(cells.filter((_, j) => j !== i));
}

resetBtn.addEventListener('click', () => {
  if (currentFile && !busy) loadFile(currentFile);
});

saveBtn.addEventListener('click', async () => {
  if (!currentFile || cells.length === 0 || busy) return;
  busy = true;
  saveBtn.disabled = true;
  resultEl.hidden = true;
  progress.start('변경 사항을 적용하는 중…');

  try {
    const buffer = await readFileBuffer(currentFile);
    const ops = cells.map((c) => ({ srcIndex: c.srcIndex, rotation: c.rotation }));
    const { bytes } = await runInWorker('organize', { buffer, ops }, [buffer], (r) =>
      progress.update(r),
    );
    const name = makeOutputName(currentFile.name, '정리');
    progress.finish('완료! 다운로드를 시작합니다.');
    triggerDownload(bytes, name, 'application/pdf');
    resultEl.hidden = false;
    resultEl.querySelector('.result-meta').textContent =
      `${name} (${formatBytes(bytes.byteLength)}, ${cells.length}페이지)`;
  } catch (err) {
    progress.error(err.message ?? '저장에 실패했습니다. 원본 파일은 그대로 보존됩니다.');
  } finally {
    busy = false;
    saveBtn.disabled = cells.length === 0;
  }
});
