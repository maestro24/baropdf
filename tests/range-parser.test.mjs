import { test, report, assert } from './helpers/harness.mjs';
import { parseRanges, uniqueSorted } from '../js/core/range-parser.js';

test('단일 페이지: "3"', () => {
  assert.deepEqual(parseRanges('3', 10), { ok: true, pages: [3] });
});

test('기본 범위: "1-3"', () => {
  assert.deepEqual(parseRanges('1-3', 10).pages, [1, 2, 3]);
});

test('복합: "1-3,5,7-" (열린 끝)', () => {
  assert.deepEqual(parseRanges('1-3,5,7-', 9).pages, [1, 2, 3, 5, 7, 8, 9]);
});

test('열린 시작: "-3"', () => {
  assert.deepEqual(parseRanges('-3', 10).pages, [1, 2, 3]);
});

test('공백 허용: " 1 - 2 , 4 "', () => {
  assert.deepEqual(parseRanges(' 1 - 2 , 4 ', 5).pages, [1, 2, 4]);
});

test('중복 허용 (입력 순서 보존): "2,1,2"', () => {
  assert.deepEqual(parseRanges('2,1,2', 5).pages, [2, 1, 2]);
});

test('경계: 마지막 페이지 정확히 "10"', () => {
  assert.deepEqual(parseRanges('10', 10).pages, [10]);
});

test('경계: 전체 범위 "1-10"', () => {
  assert.equal(parseRanges('1-10', 10).pages.length, 10);
});

test('초과 페이지 거부: "11" (총 10페이지)', () => {
  const r = parseRanges('11', 10);
  assert.equal(r.ok, false);
  assert.match(r.error, /11페이지는 없습니다/);
});

test('역순 범위 거부: "5-2"', () => {
  const r = parseRanges('5-2', 10);
  assert.equal(r.ok, false);
  assert.match(r.error, /시작.*끝.*큽니다/);
});

test('0 페이지 거부: "0"', () => {
  assert.equal(parseRanges('0', 10).ok, false);
});

test('빈 입력 거부', () => {
  assert.equal(parseRanges('', 10).ok, false);
  assert.equal(parseRanges('   ', 10).ok, false);
});

test('빈 항목 거부: "1,,3"', () => {
  assert.equal(parseRanges('1,,3', 10).ok, false);
});

test('형식 오류 거부: "a-b", "1--3", "-"', () => {
  assert.equal(parseRanges('a-b', 10).ok, false);
  assert.equal(parseRanges('1--3', 10).ok, false);
  assert.equal(parseRanges('-', 10).ok, false);
});

test('총 페이지 수가 잘못되면 거부', () => {
  assert.equal(parseRanges('1', 0).ok, false);
  assert.equal(parseRanges('1', 1.5).ok, false);
});

test('uniqueSorted: 중복 제거 + 오름차순', () => {
  assert.deepEqual(uniqueSorted([5, 1, 3, 1, 5]), [1, 3, 5]);
});

await report();
