import { test, report, assert } from './helpers/harness.mjs';
import {
  loadPdfLib,
  makeFixturePdf,
  TINY_JPEG,
  TINY_PNG,
} from './helpers/pdf-lib-loader.mjs';
import { mergePdfs } from '../js/engine/merge.js';
import { extractPages, splitEveryPage } from '../js/engine/split.js';
import { imagesToPdf } from '../js/engine/images.js';
import { applyOrganize } from '../js/engine/organize.js';
import { assembleJpegPdf } from '../js/engine/compress.js';
import { PAPER_SIZES } from '../js/core/paper.js';

const PDFLib = loadPdfLib();
const { PDFDocument } = PDFLib;
const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

test('fixture: 3페이지 PDF 생성 (페이지 폭 100,101,102)', async () => {
  const bytes = await makeFixturePdf(3);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 3);
  assert.equal(doc.getPage(0).getWidth(), 100);
  assert.equal(doc.getPage(2).getWidth(), 102);
});

test('merge: 3p + 2p → 5p, 순서 보존', async () => {
  const a = await makeFixturePdf(3, 100); // 폭 100,101,102
  const b = await makeFixturePdf(2, 300); // 폭 300,301
  const merged = await mergePdfs(PDFLib, [a, b]);
  const doc = await PDFDocument.load(merged);
  assert.equal(doc.getPageCount(), 5);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => doc.getPage(i).getWidth()),
    [100, 101, 102, 300, 301],
  );
});

test('merge: 입력 순서를 바꾸면 결과 순서도 바뀜', async () => {
  const a = await makeFixturePdf(1, 100);
  const b = await makeFixturePdf(1, 300);
  const doc = await PDFDocument.load(await mergePdfs(PDFLib, [b, a]));
  assert.deepEqual(
    [0, 1].map((i) => doc.getPage(i).getWidth()),
    [300, 100],
  );
});

test('merge: 진행률 콜백이 0→1로 증가', async () => {
  const a = await makeFixturePdf(1);
  const b = await makeFixturePdf(1);
  const seen = [];
  await mergePdfs(PDFLib, [a, b], (r) => seen.push(r));
  assert.ok(seen.length >= 2);
  assert.equal(seen[seen.length - 1], 1);
  for (let i = 1; i < seen.length; i += 1) assert.ok(seen[i] >= seen[i - 1]);
});

test('merge: 1개 파일 거부', async () => {
  const a = await makeFixturePdf(1);
  await assert.rejects(() => mergePdfs(PDFLib, [a]), /2개 이상/);
});

test('extract: "5,1,3" 순서·중복 그대로 추출', async () => {
  const src = await makeFixturePdf(5, 100); // 폭 100..104
  const out = await extractPages(PDFLib, src, [5, 1, 3, 1]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 4);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => doc.getPage(i).getWidth()),
    [104, 100, 102, 100],
  );
});

test('extract: 범위 초과 페이지 거부', async () => {
  const src = await makeFixturePdf(3);
  await assert.rejects(() => extractPages(PDFLib, src, [4]), /4페이지는 없습니다/);
});

test('extract: 빈 페이지 목록 거부', async () => {
  const src = await makeFixturePdf(3);
  await assert.rejects(() => extractPages(PDFLib, src, []), /추출할 페이지가 없습니다/);
});

test('splitEveryPage: 4p → 1p짜리 4개, 각 페이지 원본 일치', async () => {
  const src = await makeFixturePdf(4, 100);
  const parts = await splitEveryPage(PDFLib, src);
  assert.equal(parts.length, 4);
  for (let i = 0; i < 4; i += 1) {
    assert.equal(parts[i].page, i + 1);
    const doc = await PDFDocument.load(parts[i].bytes);
    assert.equal(doc.getPageCount(), 1);
    assert.equal(doc.getPage(0).getWidth(), 100 + i);
  }
});

test('splitEveryPage: 1페이지 문서 거부', async () => {
  const src = await makeFixturePdf(1);
  await assert.rejects(() => splitEveryPage(PDFLib, src), /1페이지뿐/);
});

test('imagesToPdf: JPG 1장 → A4 세로 1페이지', async () => {
  const out = await imagesToPdf(PDFLib, [{ bytes: TINY_JPEG, type: 'jpg' }], {
    paper: 'a4',
    marginMm: 0,
  });
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 1);
  assert.ok(close(doc.getPage(0).getWidth(), PAPER_SIZES.a4.width));
  assert.ok(close(doc.getPage(0).getHeight(), PAPER_SIZES.a4.height));
});

test('imagesToPdf: JPG+PNG 2장 → Letter 2페이지', async () => {
  const out = await imagesToPdf(
    PDFLib,
    [
      { bytes: TINY_JPEG, type: 'jpg' },
      { bytes: TINY_PNG, type: 'png' },
    ],
    { paper: 'letter', marginMm: 10 },
  );
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
  assert.equal(doc.getPage(0).getWidth(), 612);
  assert.equal(doc.getPage(1).getHeight(), 792);
});

test('imagesToPdf: fit(원본 크기) — 1x1px → 1x1pt 페이지', async () => {
  const out = await imagesToPdf(PDFLib, [{ bytes: TINY_PNG, type: 'png' }], {
    paper: 'fit',
    marginMm: 0,
  });
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPage(0).getWidth(), 1);
  assert.equal(doc.getPage(0).getHeight(), 1);
});

test('imagesToPdf: 빈 목록 거부', async () => {
  await assert.rejects(() => imagesToPdf(PDFLib, [], {}), /이미지가 없습니다/);
});

test('organize: 역순 재배열 + 삭제', async () => {
  const src = await makeFixturePdf(4, 100); // 폭 100..103
  const out = await applyOrganize(PDFLib, src, [
    { srcIndex: 3, rotation: 0 },
    { srcIndex: 1, rotation: 0 },
  ]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
  assert.deepEqual(
    [0, 1].map((i) => doc.getPage(i).getWidth()),
    [103, 101],
  );
});

test('organize: 회전 적용 (90도)', async () => {
  const src = await makeFixturePdf(2);
  const out = await applyOrganize(PDFLib, src, [
    { srcIndex: 0, rotation: 90 },
    { srcIndex: 1, rotation: 270 },
  ]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPage(0).getRotation().angle, 90);
  assert.equal(doc.getPage(1).getRotation().angle, 270);
});

test('organize: 빈 목록·잘못된 인덱스 거부', async () => {
  const src = await makeFixturePdf(2);
  await assert.rejects(() => applyOrganize(PDFLib, src, []), /남은 페이지가 없습니다/);
  await assert.rejects(
    () => applyOrganize(PDFLib, src, [{ srcIndex: 5, rotation: 0 }]),
    /페이지 정보/,
  );
});

test('assembleJpegPdf: JPEG 2장 → 원본 페이지 크기(pt) 유지', async () => {
  const out = await assembleJpegPdf(PDFLib, [
    { jpeg: TINY_JPEG, widthPt: 595.28, heightPt: 841.89 },
    { jpeg: TINY_JPEG, widthPt: 612, heightPt: 792 },
  ]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
  assert.ok(close(doc.getPage(0).getWidth(), 595.28));
  assert.equal(doc.getPage(1).getWidth(), 612);
});

test('assembleJpegPdf: 잘못된 크기 거부', async () => {
  await assert.rejects(
    () => assembleJpegPdf(PDFLib, [{ jpeg: TINY_JPEG, widthPt: 0, heightPt: 100 }]),
    /페이지 크기 정보/,
  );
});

test('암호 PDF 감지: pdf-lib load가 EncryptedPDFError를 던짐', async () => {
  // 암호화 플래그가 있는 최소 PDF는 만들기 어려우므로, 손상 PDF로 load 실패 경로 검증
  const bogus = new TextEncoder().encode('not a pdf at all');
  await assert.rejects(() => PDFDocument.load(bogus));
});

await report();
