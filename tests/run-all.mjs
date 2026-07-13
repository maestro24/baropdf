/** 전체 테스트 러너: node tests/run-all.mjs */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();

let totalPassed = 0;
let totalCount = 0;
let anyFail = false;

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const r = spawnSync(process.execPath, [path.join(dir, file)], { encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  const m = /RESULT (\d+)\/(\d+) passed/.exec(r.stdout ?? '');
  if (m) {
    totalPassed += Number(m[1]);
    totalCount += Number(m[2]);
  }
  if (r.status !== 0) anyFail = true;
}

console.log(`\nTOTAL ${totalPassed}/${totalCount} tests passed across ${files.length} files`);
process.exit(anyFail ? 1 : 0);
