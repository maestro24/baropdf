/**
 * Worker 래퍼 — 요청을 Promise로, 진행률을 콜백으로 제공.
 */

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../../worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { id, type, value, result, message, code } = event.data;
      const job = pending.get(id);
      if (!job) return;
      if (type === 'progress') {
        job.onProgress(value);
        return;
      }
      pending.delete(id);
      if (type === 'done') {
        job.resolve(result);
      } else {
        const err = new Error(message ?? '처리 중 문제가 발생했습니다.');
        err.code = code;
        job.reject(err);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const err = new Error('처리 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      for (const job of pending.values()) job.reject(err);
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  return worker;
}

/**
 * @param {string} cmd
 * @param {object} payload
 * @param {Transferable[]} [transfer]
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<object>}
 */
export function runInWorker(cmd, payload, transfer = [], onProgress = () => {}) {
  seq += 1;
  const id = seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, cmd, payload }, transfer);
  });
}
