import { supabase } from '../lib/supabase'
import type { LookupType, LookupValue } from '../types'

/** 대분류 목록 조회 (구분 기준 정렬) */
export async function fetchLookupTypes(): Promise<LookupType[]> {
  const { data, error } = await supabase
    .from('mr_lookup_type')
    .select('*')
    .order('lookup_type_nm', { ascending: true })
  if (error) {
    console.error('[fetchLookupTypes]', error.message, error.details)
    throw new Error(error.message || '대분류 조회 실패')
  }
  return (data ?? []) as LookupType[]
}

/** 중분류 목록 조회 (대분류 선택 시, 순서(seq) 기준 정렬) */
export async function fetchLookupValues(lookupTypeId: number): Promise<LookupValue[]> {
  const { data, error } = await supabase
    .from('mr_lookup_value')
    .select('*')
    .eq('lookup_type_id', lookupTypeId)
    .order('seq', { ascending: true, nullsFirst: false })
  if (error) {
    console.error('[fetchLookupValues]', error.message, error.details)
    throw new Error(error.message || '중분류 조회 실패')
  }
  return (data ?? []) as LookupValue[]
}

/** 대분류 신규 코드: max(nvl(lookup_type_cd, 100)) + 10 */
async function nextLookupTypeCd(): Promise<number> {
  const { data, error } = await supabase
    .from('mr_lookup_type')
    .select('lookup_type_cd')
  if (error) throw error
  const codes = (data ?? []).map((r: { lookup_type_cd: number }) => r.lookup_type_cd)
  const max = codes.length ? Math.max(100, ...codes) : 100
  return max + 10
}

/** 중분류 신규 코드: 해당 type 내 max(nvl(lookup_value_cd, 100)) + 10 */
async function nextLookupValueCd(lookupTypeId: number): Promise<number> {
  const { data, error } = await supabase
    .from('mr_lookup_value')
    .select('lookup_value_cd')
    .eq('lookup_type_id', lookupTypeId)
  if (error) throw error
  const codes = (data ?? []).map((r: { lookup_value_cd: number }) => r.lookup_value_cd)
  const max = codes.length ? Math.max(100, ...codes) : 100
  return max + 10
}

/** YYYY-MM-DD → YYYYMMDD */
function toYmd(s: string): string {
  return s.replace(/-/g, '')
}

/** YYYYMMDD(또는 숫자) → YYYY-MM-DD (연도 4자리) */
export function fromYmd(s: string | number | null): string {
  if (s == null) return ''
  const str = String(s).replace(/\D/g, '')
  if (str.length >= 8) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`
  return ''
}

/** 날짜 문자열을 연도 4자리 YYYY-MM-DD로 정규화 (등록/수정 시 6자리 연도 방지) */
export function normalizeDateTo4DigitYear(v: string): string {
  if (!v || typeof v !== 'string') return ''
  const digits = v.replace(/\D/g, '')
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return ''
}

/** 오늘 YYYYMMDD */
function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** 대분류 추가 */
export async function insertLookupType(lookupTypeNm: string): Promise<LookupType> {
  const lookupTypeCd = await nextLookupTypeCd()
  const { data, error } = await supabase
    .from('mr_lookup_type')
    .insert({ lookup_type_cd: lookupTypeCd, lookup_type_nm: lookupTypeNm })
    .select()
    .single()
  if (error) throw error
  return data as LookupType
}

/** 대분류 수정 */
export async function updateLookupType(
  lookupTypeId: number,
  lookupTypeNm: string
): Promise<void> {
  const { error } = await supabase
    .from('mr_lookup_type')
    .update({ lookup_type_nm: lookupTypeNm })
    .eq('lookup_type_id', lookupTypeId)
  if (error) throw error
}

/** 중분류 추가 */
export async function insertLookupValue(
  lookupTypeId: number,
  payload: {
    lookup_value_nm: string
    remark: string | null
    seq: number
    start_ymd: string
    end_ymd: string
  }
): Promise<LookupValue> {
  const lookupValueCd = await nextLookupValueCd(lookupTypeId)
  const row = {
    lookup_type_id: lookupTypeId,
    lookup_value_cd: lookupValueCd,
    lookup_value_nm: payload.lookup_value_nm,
    remark: payload.remark || null,
    seq: payload.seq,
    start_ymd: toYmd(payload.start_ymd),
    end_ymd: toYmd(payload.end_ymd),
    create_ymd: todayYmd(),
  }
  const { data, error } = await supabase
    .from('mr_lookup_value')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as LookupValue
}

/** 중분류 수정 */
export async function updateLookupValue(
  lookupValueId: number,
  payload: {
    lookup_value_nm: string
    remark: string | null
    seq: number
    start_ymd: string
    end_ymd: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('mr_lookup_value')
    .update({
      lookup_value_nm: payload.lookup_value_nm,
      remark: payload.remark || null,
      seq: payload.seq,
      start_ymd: toYmd(payload.start_ymd),
      end_ymd: toYmd(payload.end_ymd),
    })
    .eq('lookup_value_id', lookupValueId)
  if (error) throw error
}

/** 중분류 삭제 */
export async function deleteLookupValue(lookupValueId: number): Promise<void> {
  const { error } = await supabase
    .from('mr_lookup_value')
    .delete()
    .eq('lookup_value_id', lookupValueId)
  if (error) throw error
}

/** lookup_type_cd로 대분류 ID 조회 */
async function getLookupTypeIdByCd(lookupTypeCd: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('mr_lookup_type')
    .select('lookup_type_id')
    .eq('lookup_type_cd', lookupTypeCd)
    .maybeSingle()
  if (error) throw error
  return data?.lookup_type_id ?? null
}

/** lookup_type_cd로 중분류 목록 조회 (드롭다운용). option: validAt 있으면 해당 일자 기준 유효한 것만 */
export async function fetchLookupValuesByTypeCd(
  lookupTypeCd: number,
  option?: { validAt?: string }
): Promise<LookupValue[]> {
  const typeId = await getLookupTypeIdByCd(lookupTypeCd)
  if (typeId == null) return []
  const { data, error } = await supabase
    .from('mr_lookup_value')
    .select('*')
    .eq('lookup_type_id', typeId)
    .order('seq', { ascending: true, nullsFirst: false })
  if (error) throw error
  let list = (data ?? []) as LookupValue[]
  if (option?.validAt) {
    const ymd = option.validAt.replace(/-/g, '')
    list = list.filter(
      (v) =>
        (!v.start_ymd || String(v.start_ymd).replace(/-/g, '') <= ymd) &&
        (!v.end_ymd || String(v.end_ymd).replace(/-/g, '') >= ymd)
    )
  }
  return list
}
