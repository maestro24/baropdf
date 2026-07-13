import { test, report, assert } from './helpers/harness.mjs';
import { crc32 } from '../js/core/crc32.js';
import { buildZip } from '../js/core/zip.js';

const enc = new TextEncoder();

test('CRC32 알려진 벡터: "123456789" → 0xCBF43926', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
});

test('CRC32 알려진 벡터: 빈 입력 → 0', () => {
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('CRC32 알려진 벡터: "a" → 0xE8B7BE43', () => {
  assert.equal(crc32(enc.encode('a')), 0xe8b7be43);
});

test('CRC32 알려진 벡터: 0x00 → 0xD202EF8D', () => {
  assert.equal(crc32(Uint8Array.of(0)), 0xd202ef8d);
});

test('ZIP: 로컬 헤더 시그니처(PK\\x03\\x04)로 시작', () => {
  const zip = buildZip([{ name: 'a.txt', data: enc.encode('hello') }]);
  const v = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(v.getUint32(0, true), 0x04034b50);
});

test('ZIP: EOCD 시그니처와 엔트리 수', () => {
  const entries = [
    { name: 'a.txt', data: enc.encode('hello') },
    { name: 'b.txt', data: enc.encode('world!') },
  ];
  const zip = buildZip(entries);
  const v = new DataView(zip.buffer, zip.byteOffset);
  const eocd = zip.length - 22;
  assert.equal(v.getUint32(eocd, true), 0x06054b50);
  assert.equal(v.getUint16(eocd + 8, true), 2); // 이 디스크 엔트리 수
  assert.equal(v.getUint16(eocd + 10, true), 2); // 전체 엔트리 수
});

test('ZIP: 중앙 디렉터리 오프셋·크기 정합', () => {
  const entries = [
    { name: 'a.txt', data: enc.encode('hello') },
    { name: 'bb.bin', data: Uint8Array.of(1, 2, 3, 4) },
  ];
  const zip = buildZip(entries);
  const v = new DataView(zip.buffer, zip.byteOffset);
  const eocd = zip.length - 22;
  const cdSize = v.getUint32(eocd + 12, true);
  const cdStart = v.getUint32(eocd + 16, true);
  assert.equal(cdStart + cdSize + 22, zip.length);
  assert.equal(v.getUint32(cdStart, true), 0x02014b50); // 중앙 디렉터리 시그니처
});

test('ZIP: STORE 방식 — 데이터가 원본 그대로 포함 + CRC 일치', () => {
  const data = enc.encode('바로PDF zip integrity');
  const zip = buildZip([{ name: 'k.txt', data }]);
  const v = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(v.getUint16(8, true), 0); // 압축 방식 0 = STORE
  assert.equal(v.getUint32(14, true), crc32(data)); // 로컬 헤더 CRC
  const nameLen = v.getUint16(26, true);
  const stored = zip.slice(30 + nameLen, 30 + nameLen + data.length);
  assert.deepEqual(Array.from(stored), Array.from(data));
});

test('ZIP: UTF-8 파일명 플래그와 한글 파일명 보존', () => {
  const name = '보고서_01.pdf';
  const zip = buildZip([{ name, data: Uint8Array.of(9) }]);
  const v = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(v.getUint16(6, true) & 0x0800, 0x0800); // UTF-8 플래그
  const nameLen = v.getUint16(26, true);
  const decoded = new TextDecoder().decode(zip.slice(30, 30 + nameLen));
  assert.equal(decoded, name);
});

test('ZIP: 두 번째 엔트리의 로컬 오프셋이 중앙 디렉터리에 정확히 기록', () => {
  const a = enc.encode('AAAA');
  const b = enc.encode('BB');
  const zip = buildZip([
    { name: 'a', data: a },
    { name: 'b', data: b },
  ]);
  const v = new DataView(zip.buffer, zip.byteOffset);
  const eocd = zip.length - 22;
  const cdStart = v.getUint32(eocd + 16, true);
  // 첫 중앙 레코드 건너뛰기
  const firstNameLen = v.getUint16(cdStart + 28, true);
  const second = cdStart + 46 + firstNameLen;
  const secondOffset = v.getUint32(second + 42, true);
  const expected = 30 + 1 + a.length; // 첫 로컬 헤더(30) + 이름(1) + 데이터
  assert.equal(secondOffset, expected);
  assert.equal(v.getUint32(secondOffset, true), 0x04034b50);
});

test('ZIP: 빈 목록 거부', () => {
  assert.throws(() => buildZip([]), /파일이 없습니다/);
});

await report();
