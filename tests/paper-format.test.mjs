import { test, report, assert } from './helpers/harness.mjs';
import { mmToPt, PAPER_SIZES, computePlacement } from '../js/core/paper.js';
import { formatBytes, savedPercent } from '../js/core/format.js';

const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

test('mmToPt: 25.4mm = 72pt, 210mm ≈ 595.28pt', () => {
  assert.ok(close(mmToPt(25.4), 72));
  assert.ok(close(mmToPt(210), 595.2755905511812, 0.001));
});

test('PAPER_SIZES: A4·Letter 규격', () => {
  assert.ok(close(PAPER_SIZES.a4.width, 595.28, 0.01));
  assert.ok(close(PAPER_SIZES.a4.height, 841.89, 0.01));
  assert.equal(PAPER_SIZES.letter.width, 612);
  assert.equal(PAPER_SIZES.letter.height, 792);
});

test('computePlacement: 세로 이미지 → A4 세로, 비율 유지·중앙 정렬', () => {
  const p = computePlacement(1000, 2000, 'a4', 0);
  assert.ok(close(p.pageWidth, PAPER_SIZES.a4.width));
  assert.ok(close(p.pageHeight, PAPER_SIZES.a4.height));
  assert.ok(close(p.drawWidth / p.drawHeight, 0.5, 0.001)); // 비율 유지
  assert.ok(close(p.x * 2 + p.drawWidth, p.pageWidth, 0.01)); // 가로 중앙
  assert.ok(p.drawHeight <= p.pageHeight + 0.01);
});

test('computePlacement: 가로 이미지 → 자동 가로 용지', () => {
  const p = computePlacement(2000, 1000, 'a4', 0);
  assert.ok(close(p.pageWidth, PAPER_SIZES.a4.height));
  assert.ok(close(p.pageHeight, PAPER_SIZES.a4.width));
});

test('computePlacement: 여백 반영 (10mm)', () => {
  const m = mmToPt(10);
  const p = computePlacement(595, 842, 'a4', 10);
  assert.ok(p.x >= m - 0.01);
  assert.ok(p.y >= m - 0.01);
  assert.ok(p.drawWidth <= p.pageWidth - m * 2 + 0.01);
});

test('computePlacement: fit(원본 크기) — 이미지 크기 그대로 + 여백', () => {
  const p = computePlacement(300, 500, 'fit', 0);
  assert.equal(p.pageWidth, 300);
  assert.equal(p.pageHeight, 500);
  assert.equal(p.drawWidth, 300);
  const m = mmToPt(10);
  const p2 = computePlacement(300, 500, 'fit', 10);
  assert.ok(close(p2.pageWidth, 300 + m * 2));
});

test('computePlacement: 잘못된 입력 거부', () => {
  assert.throws(() => computePlacement(0, 100, 'a4'), /이미지 크기/);
  assert.throws(() => computePlacement(100, 100, 'b5'), /지원하지 않는 용지/);
  assert.throws(() => computePlacement(100, 100, 'a4', 200), /여백이 너무 큽니다/);
});

test('formatBytes: 단위 변환', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(-1), '-');
});

test('savedPercent: 절감률 계산', () => {
  assert.equal(savedPercent(1000, 400), 60);
  assert.equal(savedPercent(1000, 1100), -10);
  assert.equal(savedPercent(0, 100), 0);
});

await report();
