/**
 * 진행률 바 + 상태 메시지 + 에러 표시.
 */

/**
 * @param {HTMLElement} root  .progress-area 요소 (내부에 bar/label 생성)
 */
export function createProgress(root) {
  root.innerHTML =
    '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
    '<div class="progress-fill"></div></div>' +
    '<p class="progress-label"></p>';
  const track = root.querySelector('.progress-track');
  const fill = root.querySelector('.progress-fill');
  const label = root.querySelector('.progress-label');
  root.hidden = true;

  return {
    start(message = '처리 중…') {
      root.hidden = false;
      root.classList.remove('is-error');
      fill.style.width = '0%';
      label.textContent = message;
      track.setAttribute('aria-valuenow', '0');
    },
    update(ratio, message) {
      const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
      fill.style.width = `${pct}%`;
      track.setAttribute('aria-valuenow', String(pct));
      if (message) label.textContent = message;
    },
    finish(message = '완료!') {
      fill.style.width = '100%';
      track.setAttribute('aria-valuenow', '100');
      label.textContent = message;
    },
    error(message) {
      root.hidden = false;
      root.classList.add('is-error');
      label.textContent = message;
    },
    hide() {
      root.hidden = true;
    },
  };
}
