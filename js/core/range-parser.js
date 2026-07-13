/**
 * 페이지 범위 파서 — "1-3,5,7-" 형태의 문자열을 1-기반 페이지 번호 배열로 변환.
 * 순수 함수, DOM 의존 없음 (Node 테스트 대상).
 */

const TOKEN_RE = /^(\d*)\s*-\s*(\d*)$|^(\d+)$/;

/**
 * @param {string} input  예: "1-3,5,7-"
 * @param {number} totalPages  문서 전체 페이지 수 (1 이상 정수)
 * @returns {{ ok: true, pages: number[] } | { ok: false, error: string }}
 *   pages: 입력 순서를 보존한 1-기반 페이지 번호 배열 (중복 허용 — 추출 시 중복 페이지 복사 가능)
 */
export function parseRanges(input, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return fail('문서 페이지 수가 올바르지 않습니다.');
  }
  if (typeof input !== 'string' || input.trim() === '') {
    return fail('페이지 범위를 입력해 주세요. 예: 1-3,5,7-');
  }

  const tokens = input.split(',').map((t) => t.trim());
  const pages = [];

  for (const token of tokens) {
    if (token === '') {
      return fail('빈 항목이 있습니다. 쉼표 사이에 범위를 입력해 주세요.');
    }
    const m = TOKEN_RE.exec(token);
    if (!m) {
      return fail(`"${token}" 은(는) 올바른 형식이 아닙니다. 예: 1-3, 5, 7-`);
    }

    if (m[3] !== undefined) {
      const page = Number(m[3]);
      const err = checkPage(page, totalPages, token);
      if (err) return fail(err);
      pages.push(page);
      continue;
    }

    const startRaw = m[1];
    const endRaw = m[2];
    if (startRaw === '' && endRaw === '') {
      return fail('"-" 만으로는 범위를 알 수 없습니다. 예: 1-3');
    }
    const start = startRaw === '' ? 1 : Number(startRaw);
    const end = endRaw === '' ? totalPages : Number(endRaw);

    const startErr = checkPage(start, totalPages, token);
    if (startErr) return fail(startErr);
    const endErr = checkPage(end, totalPages, token);
    if (endErr) return fail(endErr);
    if (start > end) {
      return fail(`"${token}": 시작(${start})이 끝(${end})보다 큽니다.`);
    }
    for (let p = start; p <= end; p += 1) pages.push(p);
  }

  if (pages.length === 0) {
    return fail('선택된 페이지가 없습니다.');
  }
  return { ok: true, pages };
}

/** 중복을 제거한 오름차순 페이지 목록 (분할 미리보기용). */
export function uniqueSorted(pages) {
  return [...new Set(pages)].sort((a, b) => a - b);
}

function checkPage(page, totalPages, token) {
  if (!Number.isInteger(page) || page < 1) {
    return `"${token}": 페이지 번호는 1 이상의 정수여야 합니다.`;
  }
  if (page > totalPages) {
    return `"${token}": ${page}페이지는 없습니다. 이 문서는 ${totalPages}페이지입니다.`;
  }
  return null;
}

function fail(error) {
  return { ok: false, error };
}
