import { useState, useEffect } from 'react'
import type { LookupValue } from '../types'
import { fetchLookupValuesByTypeCd } from '../api/lookup'

const LOOKUP_RECURRENCE_CYCLE = 170 // 반복 주기 단위 (일, 주, 월)

/** 요일 버튼 순서: 일 ~ 토 */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export interface RecurrenceCustomValue {
  cycleNumber: number
  cycleUnitCd: number | null
  cycleUnitNm: string
  selectedDays: boolean[] // [일,월,화,수,목,금,토]
}

interface RecurrenceCustomModalProps {
  isOpen: boolean
  initialValue?: Partial<RecurrenceCustomValue> | null
  onClose: () => void
  onConfirm: (value: RecurrenceCustomValue) => void
}

export default function RecurrenceCustomModal({
  isOpen,
  initialValue,
  onClose,
  onConfirm,
}: RecurrenceCustomModalProps) {
  const [cycleNumber, setCycleNumber] = useState(initialValue?.cycleNumber ?? 1)
  const [cycleOptions, setCycleOptions] = useState<LookupValue[]>([])
  const [cycleUnitCd, setCycleUnitCd] = useState<number | null>(
    initialValue?.cycleUnitCd ?? null
  )
  const [selectedDays, setSelectedDays] = useState<boolean[]>(
    initialValue?.selectedDays ?? [false, false, false, false, false, false, false]
  )

  useEffect(() => {
    if (!isOpen) return
    const today = new Date().toISOString().slice(0, 10)
    fetchLookupValuesByTypeCd(LOOKUP_RECURRENCE_CYCLE, { validAt: today })
      .then((list) => {
        setCycleOptions(list)
        if (list.length > 0 && cycleUnitCd == null) {
          setCycleUnitCd(list[0].lookup_value_cd)
        }
      })
      .catch(() => setCycleOptions([]))
  }, [isOpen])

  useEffect(() => {
    if (initialValue?.cycleNumber != null) setCycleNumber(initialValue.cycleNumber)
    if (initialValue?.cycleUnitCd != null) setCycleUnitCd(initialValue.cycleUnitCd)
    if (initialValue?.selectedDays?.length === 7) setSelectedDays(initialValue.selectedDays)
  }, [isOpen, initialValue])

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const handleConfirm = () => {
    const unit = cycleOptions.find((o) => o.lookup_value_cd === cycleUnitCd)
    onConfirm({
      cycleNumber,
      cycleUnitCd: cycleUnitCd ?? null,
      cycleUnitNm: unit?.lookup_value_nm ?? '',
      selectedDays,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay recurrence-custom-modal-overlay" onClick={onClose}>
      <div
        className="recurrence-custom-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="recurrence-custom-modal-header">
          <h2>반복 사용자 설정</h2>
        </div>
        <div className="recurrence-custom-modal-body">
          <div className="form-group">
            <label>다음 주기로 반복</label>
            <div className="recurrence-cycle-row">
              <input
                type="number"
                min={1}
                max={999}
                value={cycleNumber}
                onChange={(e) =>
                  setCycleNumber(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                onFocus={(e) => e.target.select()}
                className="recurrence-cycle-number"
              />
              <select
                className="recurrence-cycle-unit"
                value={cycleUnitCd ?? ''}
                onChange={(e) =>
                  setCycleUnitCd(
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
                aria-label="반복 주기 단위"
              >
                {cycleOptions.map((o) => (
                  <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                    {o.lookup_value_nm}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>다음 요일에 반복</label>
            <div className="recurrence-days-row">
              {WEEKDAY_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`recurrence-day-btn${selectedDays[index] ? ' recurrence-day-btn--selected' : ''}`}
                  onClick={() => toggleDay(index)}
                  aria-pressed={selectedDays[index]}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="recurrence-custom-modal-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="recurrence-custom-confirm-btn" onClick={handleConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
