import { test, report, assert } from './helpers/harness.mjs';
import { baseName, makeOutputName, pageFileName } from '../js/core/filename.js';

test('baseName: 확장자 제거', () => {
  assert.equal(baseName('보고서.pdf'), '보고서');
  assert.equal(baseName('a.b.c.pdf'), 'a.b.c');
});

test('baseName: 확장자 없는 이름 유지', () => {
  assert.equal(baseName('README'), 'README');
});

test('baseName: 경로 제거·금지 문자 치환, 빈 이름 대체', () => {
  assert.equal(baseName('dir/a:b*.pdf'), 'a_b_'); // 경로는 잘리고 금지 문자는 _
  assert.equal(baseName(''), 'document');
  assert.equal(baseName(undefined), 'document');
});

test('makeOutputName: 접미사 + 확장자', () => {
  assert.equal(makeOutputName('보고서.pdf', '합침'), '보고서_합침.pdf');
  assert.equal(makeOutputName('scan.PDF', '분할', 'zip'), 'scan_분할.zip');
});

test('makeOutputName: 접미사 없으면 기본 이름만', () => {
  assert.equal(makeOutputName('x.pdf', ''), 'x.pdf');
});

test('pageFileName: 자릿수 0 채움 (총량 기준, 최소 2자리)', () => {
  assert.equal(pageFileName('보고서.pdf', 3, 12, 'jpg'), '보고서_03.jpg');
  assert.equal(pageFileName('a.pdf', 7, 150, 'pdf'), 'a_007.pdf');
  assert.equal(pageFileName('a.pdf', 1, 1, 'jpg'), 'a_01.jpg');
});

await report();
