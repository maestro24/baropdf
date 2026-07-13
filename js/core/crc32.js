/**
 * CRC-32 (IEEE 802.3, ZIP에서 사용하는 다항식 0xEDB88320) 구현.
 * 순수 함수, DOM 의존 없음.
 */

const TABLE = buildTable();

function buildTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * @param {Uint8Array} bytes
 * @returns {number} 부호 없는 32비트 CRC 값
 */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
