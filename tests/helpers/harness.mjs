/** 최소 테스트 하네스 — node tests/xxx.test.mjs 로 실행 */
import assert from 'node:assert/strict';

const tests = [];

export { assert };

export function test(name, fn) {
  tests.push({ name, fn });
}

export async function report() {
  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`  PASS ${t.name}`);
    } catch (err) {
      failures.push(t.name);
      console.error(`  FAIL ${t.name}\n       ${err.message}`);
    }
  }
  console.log(`RESULT ${passed}/${tests.length} passed`);
  if (failures.length > 0) process.exit(1);
}
