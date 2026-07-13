/**
 * pdf-lib / pdf.js 에러를 사용자 친화 한국어 메시지로 변환.
 */

export const MSG = Object.freeze({
  ENCRYPTED:
    '암호가 걸린 PDF입니다. 먼저 PDF 뷰어에서 암호를 해제한 뒤 다시 시도해 주세요.',
  CORRUPT:
    'PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 PDF 형식이 아닐 수 있습니다.',
  NOT_IMAGE: '이미지 파일을 읽을 수 없습니다. JPG 또는 PNG 파일인지 확인해 주세요.',
  GENERIC: '처리 중 문제가 발생했습니다. 원본 파일은 그대로 보존됩니다.',
});

/** 에러 객체를 분류해 한국어 메시지를 돌려준다. */
export function toFriendlyMessage(err) {
  const name = err?.name ?? '';
  const text = String(err?.message ?? err ?? '');

  if (
    name === 'EncryptedPDFError' ||
    name === 'PasswordException' ||
    /encrypted|password/i.test(text)
  ) {
    return MSG.ENCRYPTED;
  }
  if (
    /no pdf header|invalid pdf|failed to parse|trailer|xref|corrupt|InvalidPDFException/i.test(
      `${name} ${text}`,
    )
  ) {
    return MSG.CORRUPT;
  }
  if (/jpg|jpeg|png|image/i.test(text) && /fail|unable|invalid|parse/i.test(text)) {
    return MSG.NOT_IMAGE;
  }
  return MSG.GENERIC;
}
