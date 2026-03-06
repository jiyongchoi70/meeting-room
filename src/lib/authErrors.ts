/**
 * Supabase Auth 등에서 오는 영문 에러 메시지를 한글로 변환합니다.
 */
const AUTH_ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials|invalid credentials/i, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
  { pattern: /email not confirmed/i, message: '이메일 인증이 완료되지 않았습니다.' },
  { pattern: /user already registered|already exists|already registered/i, message: '이미 가입된 사용자입니다.' },
  { pattern: /password should be at least \d+ characters/i, message: '비밀번호는 6자 이상이어야 합니다.' },
  { pattern: /unable to validate email|invalid format/i, message: '올바른 이메일 형식이 아닙니다.' },
  { pattern: /new password should be different/i, message: '새 비밀번호는 기존과 달라야 합니다.' },
  { pattern: /token has expired|is invalid|invalid token/i, message: '링크가 만료되었거나 올바르지 않습니다.' },
  { pattern: /forbidden|access denied/i, message: '접근이 거부되었습니다.' },
  { pattern: /duplicate key|unique constraint|already exists/i, message: '이미 등록된 정보입니다.' },
]

export function authErrorMessage(englishMessage: string | null | undefined, fallback: string): string {
  const msg = (englishMessage ?? '').trim()
  if (!msg) return fallback
  for (const { pattern, message } of AUTH_ERROR_MAP) {
    if (pattern.test(msg)) return message
  }
  return msg
}
