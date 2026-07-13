/**
 * 최소 ZIP 빌더 — STORE(무압축) 방식, CRC32 무결성 포함.
 * 여러 이미지 파일을 하나의 ZIP으로 묶어 다운로드할 때 사용.
 * 순수 함수, DOM 의존 없음.
 */

import { crc32 } from './crc32.js';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const VERSION = 20; // 2.0 — STORE만 사용
const FLAG_UTF8 = 0x0800;

const encoder = new TextEncoder();

/**
 * @param {Array<{ name: string, data: Uint8Array }>} entries
 * @returns {Uint8Array} 완성된 ZIP 바이너리 (새 버퍼 — 입력 불변)
 */
export function buildZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('ZIP에 담을 파일이 없습니다.');
  }

  const { date, time } = dosDateTime(new Date());
  const records = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
    offset: 0,
  }));

  let size = 0;
  for (const r of records) {
    r.offset = size;
    size += 30 + r.nameBytes.length + r.data.length; // 로컬 헤더 + 데이터
  }
  const centralStart = size;
  for (const r of records) {
    size += 46 + r.nameBytes.length; // 중앙 디렉터리 레코드
  }
  size += 22; // EOCD

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let pos = 0;

  // 로컬 파일 헤더 + 데이터
  for (const r of records) {
    view.setUint32(pos, SIG_LOCAL, true);
    view.setUint16(pos + 4, VERSION, true);
    view.setUint16(pos + 6, FLAG_UTF8, true);
    view.setUint16(pos + 8, 0, true); // STORE
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, date, true);
    view.setUint32(pos + 14, r.crc, true);
    view.setUint32(pos + 18, r.data.length, true);
    view.setUint32(pos + 22, r.data.length, true);
    view.setUint16(pos + 26, r.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    pos += 30;
    out.set(r.nameBytes, pos);
    pos += r.nameBytes.length;
    out.set(r.data, pos);
    pos += r.data.length;
  }

  // 중앙 디렉터리
  for (const r of records) {
    view.setUint32(pos, SIG_CENTRAL, true);
    view.setUint16(pos + 4, VERSION, true);
    view.setUint16(pos + 6, VERSION, true);
    view.setUint16(pos + 8, FLAG_UTF8, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, time, true);
    view.setUint16(pos + 14, date, true);
    view.setUint32(pos + 16, r.crc, true);
    view.setUint32(pos + 20, r.data.length, true);
    view.setUint32(pos + 24, r.data.length, true);
    view.setUint16(pos + 28, r.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true); // extra
    view.setUint16(pos + 32, 0, true); // comment
    view.setUint16(pos + 34, 0, true); // disk
    view.setUint16(pos + 36, 0, true); // internal attrs
    view.setUint32(pos + 38, 0, true); // external attrs
    view.setUint32(pos + 42, r.offset, true);
    pos += 46;
    out.set(r.nameBytes, pos);
    pos += r.nameBytes.length;
  }

  // EOCD
  const centralSize = pos - centralStart;
  view.setUint32(pos, SIG_EOCD, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, records.length, true);
  view.setUint16(pos + 10, records.length, true);
  view.setUint32(pos + 12, centralSize, true);
  view.setUint32(pos + 16, centralStart, true);
  view.setUint16(pos + 20, 0, true);

  return out;
}

function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear());
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { date, time };
}
