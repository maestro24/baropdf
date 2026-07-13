/**
 * 파일 리스트 — 이름·크기 표시, 제거, 위/아래·드래그 순서 변경.
 * 상태는 불변 배열로 관리하고 매번 다시 그린다.
 */

import { formatBytes } from '../core/format.js';

/**
 * @param {HTMLElement} container
 * @param {{ reorder?: boolean, onChange?: (files: File[]) => void }} [opts]
 * @returns {{ add(files: File[]): void, getFiles(): File[], clear(): void }}
 */
export function createFileList(container, opts = {}) {
  const reorder = opts.reorder ?? true;
  const onChange = opts.onChange ?? (() => {});
  let items = [];
  let dragFrom = -1;

  function setItems(next) {
    items = next;
    render();
    onChange(items.map((it) => it.file));
  }

  function move(from, to) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  }

  function render() {
    container.textContent = '';
    container.classList.toggle('is-empty', items.length === 0);
    items.forEach((item, i) => {
      const row = document.createElement('li');
      row.className = 'file-row';
      if (reorder) {
        row.draggable = true;
        row.addEventListener('dragstart', () => {
          dragFrom = i;
          row.classList.add('is-dragging');
        });
        row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          if (dragFrom >= 0) move(dragFrom, i);
          dragFrom = -1;
        });
      }

      const order = document.createElement('span');
      order.className = 'file-order';
      order.textContent = String(i + 1);

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = item.file.name;
      name.title = item.file.name;

      const size = document.createElement('span');
      size.className = 'file-size';
      size.textContent = formatBytes(item.file.size);

      const actions = document.createElement('span');
      actions.className = 'file-actions';
      if (reorder) {
        actions.append(
          iconButton('▲', '위로', () => move(i, i - 1)),
          iconButton('▼', '아래로', () => move(i, i + 1)),
        );
      }
      actions.append(
        iconButton('✕', '제거', () => setItems(items.filter((_, j) => j !== i))),
      );

      row.append(order, name, size, actions);
      container.append(row);
    });
  }

  function iconButton(text, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.textContent = text;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  return {
    add(files) {
      setItems([...items, ...files.map((file) => ({ file }))]);
    },
    getFiles() {
      return items.map((it) => it.file);
    },
    clear() {
      setItems([]);
    },
  };
}
