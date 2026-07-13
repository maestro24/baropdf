/** vendor/pdf-lib.min.js (UMD)를 Node에서 로드하는 헬퍼 */
import fs from 'node:fs';

let cached = null;

export function loadPdfLib() {
  if (cached) return cached;
  const src = fs.readFileSync(
    new URL('../../vendor/pdf-lib.min.js', import.meta.url),
    'utf8',
  );
  const mod = { exports: {} };
  // UMD: typeof exports==='object' && typeof module!=='undefined' → factory(exports)
  new Function('module', 'exports', src)(mod, mod.exports);
  cached = mod.exports;
  return cached;
}

/** 페이지 크기가 서로 다른(순서 검증용) N페이지 PDF fixture 생성 */
export async function makeFixturePdf(pageCount, baseWidth = 100) {
  const { PDFDocument } = loadPdfLib();
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([baseWidth + i, 200]);
    page.drawRectangle({ x: 10, y: 10, width: 30, height: 30 });
  }
  return doc.save();
}

/** 1x1 JPEG / PNG 바이트 */
export const TINY_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
    'base64',
  ),
);

export const TINY_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);
