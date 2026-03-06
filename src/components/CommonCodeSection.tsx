import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import '../common_code.css'
import type { LookupType, LookupValue } from '../types'
import {
  fetchLookupTypes,
  fetchLookupValues,
  insertLookupType,
  updateLookupType,
  insertLookupValue,
  updateLookupValue,
  deleteLookupValue,
  fromYmd,
  normalizeDateTo4DigitYear,
} from '../api/lookup'

/** 대분류 그리드 수정 셀 렌더러 (AG Grid params) */
function TypeEditCellRenderer(props: { data?: LookupType; getTypes?: () => LookupType[]; onSaved?: () => void }) {
  if (!props.data || !props.getTypes || !props.onSaved) return null
  return <TypeFormButton types={props.getTypes()} onSaved={props.onSaved} edit={props.data} isCell />
}

/** 중분류 그리드 편집 셀 렌더러 (AG Grid params) */
function ValueEditCellRenderer(props: {
  data?: LookupValue
  getValues?: () => LookupValue[]
  getLookupTypeId?: () => number | null
  onSaved?: () => void
}) {
  if (!props.data || !props.getValues || !props.getLookupTypeId || !props.onSaved) return null
  const id = props.getLookupTypeId()
  if (id == null) return null
  return (
    <ValueFormButton
      lookupTypeId={id}
      values={props.getValues()}
      onSaved={props.onSaved}
      edit={props.data}
      isCell
    />
  )
}

/** 중분류 그리드 삭제 셀 렌더러 (AG Grid params) */
function DeleteCellRenderer(props: { data?: LookupValue; onDelete?: (row: LookupValue) => void }) {
  if (!props.data || !props.onDelete) return null
  return (
    <button
      type="button"
      className="delete-btn"
      onClick={(e) => {
        e.stopPropagation()
        if (confirm('이 중분류를 삭제할까요?')) props.onDelete!(props.data!)
      }}
    >
      삭제
    </button>
  )
}

export default function CommonCodeSection() {
  const [types, setTypes] = useState<LookupType[]>([])
  const [values, setValues] = useState<LookupValue[]>([])
  const [selectedType, setSelectedType] = useState<LookupType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const masterGridRef = useRef<AgGridReact<LookupType>>(null)
  const masterApiRef = useRef<GridReadyEvent<LookupType> | null>(null)
  const detailApiRef = useRef<GridReadyEvent<LookupValue> | null>(null)
  const skipSelectionSyncRef = useRef(false)

  const loadTypes = useCallback(async () => {
    try {
      const data = await fetchLookupTypes()
      setTypes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '대분류 조회 실패')
    }
  }, [])

  const loadValues = useCallback(async (lookupTypeId: number) => {
    try {
      const data = await fetchLookupValues(lookupTypeId)
      setValues(data)
    } catch (e) {
      setValues([])
      setError(e instanceof Error ? e.message : '중분류 조회 실패')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLookupTypes()
      .then((data) => {
        if (!cancelled) {
          setTypes(data)
          if (data.length > 0) setSelectedType(data[0])
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e?.message ?? (typeof e === 'string' ? e : '조회 실패')
          setError(msg)
          console.error('[공통코드] 대분류 조회 실패:', e)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedType) {
      setValues([])
      return
    }
    loadValues(selectedType.lookup_type_id)
  }, [selectedType, loadValues])

  /** 그리드 선택 상태를 selectedType과 동기화 (초기 로드 시 대분류 첫 행 선택) */
  const syncMasterSelection = useCallback(() => {
    if (!selectedType || !masterApiRef.current?.api) return
    const api = masterApiRef.current.api
    if (api.isDestroyed?.()) return
    const node = api.getRowNode(String(selectedType.lookup_type_id))
    if (!node) return
    const alreadySelected = api.getSelectedNodes().length === 1 && api.getSelectedNodes()[0]?.data?.lookup_type_id === selectedType.lookup_type_id
    if (alreadySelected) return
    skipSelectionSyncRef.current = true
    api.deselectAll()
    node.setSelected(true)
  }, [selectedType])

  useEffect(() => {
    syncMasterSelection()
  }, [types, selectedType, syncMasterSelection])

  const onGridReadyMaster = useCallback(
    (e: GridReadyEvent<LookupType>) => {
      masterApiRef.current = e
      if (selectedType && types.length > 0) {
        requestAnimationFrame(() => {
          if (masterApiRef.current?.api?.isDestroyed?.()) return
          syncMasterSelection()
        })
      }
    },
    [selectedType, types.length, syncMasterSelection]
  )

  const onMasterSelectionChanged = useCallback((e: SelectionChangedEvent<LookupType>) => {
    if (skipSelectionSyncRef.current) {
      skipSelectionSyncRef.current = false
      return
    }
    const node = e.api.getSelectedNodes()[0]
    if (node?.data) setSelectedType(node.data)
  }, [])

  const handleExcelDownload = useCallback(() => {
    if (!selectedType || values.length === 0) return
    const headers = ['코드', '구분', '순서', '시작일', '종료일']
    const rows = values.map((v) => [
      v.lookup_value_cd,
      v.lookup_value_nm,
      v.seq ?? '',
      fromYmd(v.start_ymd) || '',
      fromYmd(v.end_ymd) || '',
    ])
    const BOM = '\uFEFF'
    const csv = BOM + [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `공통코드_${selectedType.lookup_type_nm}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [selectedType, values])

  const handleDeleteValue = useCallback(async (row: LookupValue) => {
    try {
      await deleteLookupValue(row.lookup_value_id)
      if (selectedType) loadValues(selectedType.lookup_type_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }, [selectedType, loadValues])

  const masterColumnDefs = useMemo<ColDef<LookupType>[]>(
    () => [
      { field: 'lookup_type_nm', headerName: '구분', flex: 1, minWidth: 100 },
      { field: 'lookup_type_cd', headerName: '코드', width: 90 },
      {
        headerName: '수정',
        width: 80,
        cellRenderer: TypeEditCellRenderer,
        cellRendererParams: {
          getTypes: () => types,
          onSaved: loadTypes,
        },
      },
    ],
    [types, loadTypes]
  )

  const detailColumnDefs = useMemo<ColDef<LookupValue>[]>(
    () => [
      { field: 'lookup_value_cd', headerName: '코드', width: 90 },
      { field: 'lookup_value_nm', headerName: '구분', flex: 1, minWidth: 100 },
      { field: 'seq', headerName: '순서', width: 80 },
      {
        field: 'start_ymd',
        headerName: '시작일',
        valueFormatter: (p) => (p.value ? fromYmd(p.value) : '-'),
        width: 110,
      },
      {
        field: 'end_ymd',
        headerName: '종료일',
        valueFormatter: (p) => (p.value ? fromYmd(p.value) : '-'),
        width: 110,
      },
      {
        headerName: '수정',
        width: 80,
        cellRenderer: ValueEditCellRenderer,
        cellRendererParams: {
          getValues: () => values,
          getLookupTypeId: () => selectedType?.lookup_type_id ?? null,
          onSaved: () => selectedType && loadValues(selectedType.lookup_type_id),
        },
      },
      {
        headerName: '삭제',
        width: 80,
        cellRenderer: DeleteCellRenderer,
        cellRendererParams: { onDelete: handleDeleteValue },
      },
    ],
    [values, selectedType, loadValues, handleDeleteValue]
  )

  return (
    <div className="common-code-section">
      <header className="common-code-header">
        <h2 className="common-code-page-title">공통코드 관리</h2>
        <Link to="/admin" className="common-code-home-btn">
          홈
        </Link>
      </header>
      {error && (
        <div className="common-code-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="common-code-loading">
          <div className="common-code-loading-dots">
            <span className="common-code-loading-dot" />
            <span className="common-code-loading-dot" />
            <span className="common-code-loading-dot" />
          </div>
          <p className="admin-sub-desc">불러오는 중…</p>
        </div>
      ) : (
        <div className="common-code-container">
          <div className="master-section">
            <div className="section-header">
              <span className="section-icon" aria-hidden>■</span>
              <h2>대분류</h2>
              <TypeFormButton types={types} onSaved={loadTypes} />
            </div>
            <div id="masterGrid" className="ag-theme-alpine" style={{ width: '100%', height: '500px' }}>
              <AgGridReact<LookupType>
                ref={masterGridRef}
                theme="legacy"
                rowData={types}
                columnDefs={masterColumnDefs}
                getRowId={(p) => String(p.data.lookup_type_id)}
                rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                onSelectionChanged={onMasterSelectionChanged}
                onGridReady={onGridReadyMaster}
                suppressCellFocus
                domLayout="normal"
                rowHeight={39}
                headerHeight={39}
                overlayNoRowsTemplate="데이터가 없습니다"
              />
            </div>
          </div>
          <div className="detail-section">
            <div className="section-header">
              <span className="section-icon" aria-hidden>■</span>
              <h2>중분류</h2>
              {selectedType && values.length > 0 && (
                <button type="button" className="export-excel-button" onClick={handleExcelDownload}>
                  엑셀 다운로드
                </button>
              )}
              {selectedType ? (
                <ValueFormButton
                  lookupTypeId={selectedType.lookup_type_id}
                  values={values}
                  onSaved={() => selectedType && loadValues(selectedType.lookup_type_id)}
                />
              ) : (
                <button type="button" className="add-button" disabled title="대분류를 먼저 선택하세요">
                  +
                </button>
              )}
            </div>
            <div id="detailGrid" className="ag-theme-alpine" style={{ width: '100%', height: '500px' }}>
              <AgGridReact<LookupValue>
                theme="legacy"
                rowData={values}
                columnDefs={detailColumnDefs}
                getRowId={(p) => String(p.data.lookup_value_id)}
                suppressCellFocus
                domLayout="normal"
                rowHeight={39}
                headerHeight={39}
                onGridReady={(e) => { detailApiRef.current = e }}
                overlayNoRowsTemplate="대분류를 선택하면 중분류가 표시됩니다"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 대분류 등록/수정 버튼 + 모달 */
function TypeFormButton({
  types: _types,
  onSaved,
  edit = null,
  isCell = false,
}: {
  types: LookupType[]
  onSaved: () => void
  edit?: LookupType | null
  isCell?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(edit)

  const openModal = () => {
    setName(edit?.lookup_type_nm ?? '')
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setName('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nm = name.trim()
    if (!nm) return
    setSaving(true)
    try {
      if (isEdit && edit) {
        await updateLookupType(edit.lookup_type_id, nm)
      } else {
        await insertLookupType(nm)
      }
      onSaved()
      closeModal()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className={isCell ? 'edit-btn' : 'add-button'} onClick={(e) => { e.stopPropagation(); openModal(); }} title={isEdit ? '수정' : '추가'}>
        {isEdit ? '수정' : '+'}
      </button>
      {open &&
        createPortal(
          <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
            <div className="reservation-modal common-code-modal modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{isEdit ? '대분류 수정' : '대분류 등록'}</h2>
                <button type="button" className="modal-close close-button" onClick={closeModal} aria-label="닫기">×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="type-nm">구분 <span className="required">*</span></label>
                    <input id="type-nm" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="modal-input" />
                  </div>
                </div>
                <div className="modal-footer modal-actions">
                  <button type="button" className="cancel-button" onClick={closeModal}>취소</button>
                  <button type="submit" className="save-button btn-primary" disabled={saving || !name.trim()}>저장</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

/** 중분류 등록/수정 버튼 + 모달 */
function ValueFormButton({
  lookupTypeId,
  values: _values,
  onSaved,
  edit = null,
  isCell = false,
}: {
  lookupTypeId: number
  values: LookupValue[]
  onSaved: () => void
  edit?: LookupValue | null
  isCell?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [lookup_value_nm, setLookup_value_nm] = useState('')
  const [remark, setRemark] = useState('')
  const [seq, setSeq] = useState('')
  const [start_ymd, setStart_ymd] = useState('')
  const [end_ymd, setEnd_ymd] = useState('')
  const [saving, setSaving] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const isEdit = Boolean(edit)
  const isDateValid = !start_ymd || !end_ymd || start_ymd <= end_ymd

  const openModal = () => {
    if (edit) {
      setLookup_value_nm(edit.lookup_value_nm)
      setRemark(edit.remark ?? '')
      setSeq(String(edit.seq ?? ''))
      setStart_ymd(normalizeDateTo4DigitYear(fromYmd(edit.start_ymd)))
      setEnd_ymd(normalizeDateTo4DigitYear(fromYmd(edit.end_ymd)))
    } else {
      setLookup_value_nm('')
      setRemark('')
      setSeq('')
      setStart_ymd('')
      setEnd_ymd('')
    }
    setDateError(null)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setDateError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nm = lookup_value_nm.trim()
    const seqNum = parseInt(seq, 10)
    if (!nm || !start_ymd || !end_ymd || Number.isNaN(seqNum) || seqNum < 0) return
    if (start_ymd > end_ymd) {
      setDateError('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setDateError(null)
    setSaving(true)
    try {
      const start = normalizeDateTo4DigitYear(start_ymd) || start_ymd
      const end = normalizeDateTo4DigitYear(end_ymd) || end_ymd
      const payload = { lookup_value_nm: nm, remark: remark.trim() || null, seq: seqNum, start_ymd: start, end_ymd: end }
      if (isEdit && edit) {
        await updateLookupValue(edit.lookup_value_id, payload)
      } else {
        await insertLookupValue(lookupTypeId, payload)
      }
      onSaved()
      closeModal()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className={isCell ? 'edit-btn' : 'add-button'} onClick={(e) => { e.stopPropagation(); openModal(); }} title={isEdit ? '수정' : '추가'}>
        {isEdit ? '수정' : '+'}
      </button>
      {open &&
        createPortal(
          <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
            <div className="reservation-modal common-code-modal modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{isEdit ? '중분류 수정' : '중분류 등록'}</h2>
                <button type="button" className="modal-close close-button" onClick={closeModal} aria-label="닫기">×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="value-nm">구분 <span className="required">*</span></label>
                    <input id="value-nm" type="text" value={lookup_value_nm} onChange={(e) => setLookup_value_nm(e.target.value)} required autoFocus className="modal-input" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="value-remark">설명</label>
                    <input id="value-remark" type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="modal-input" />
                  </div>
                  <div className="form-group form-group--full">
                    <label htmlFor="value-seq">순서 <span className="required">*</span></label>
                    <input id="value-seq" type="number" min={0} value={seq} onChange={(e) => setSeq(e.target.value)} className="modal-input" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="value-start">시작일 <span className="required">*</span></label>
                    <input id="value-start" type="date" value={start_ymd} onChange={(e) => { const next = normalizeDateTo4DigitYear(e.target.value) || e.target.value; setStart_ymd(next); setDateError(null); }} className="modal-input" required min="1900-01-01" max="9999-12-31" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="value-end">종료일 <span className="required">*</span></label>
                    <input id="value-end" type="date" value={end_ymd} onChange={(e) => { const next = normalizeDateTo4DigitYear(e.target.value) || e.target.value; setEnd_ymd(next); setDateError(null); }} className="modal-input" required min="1900-01-01" max="9999-12-31" />
                  </div>
                  {dateError && <p className="common-code-form-error" role="alert">{dateError}</p>}
                </div>
                <div className="modal-footer modal-actions">
                  <button type="button" className="cancel-button" onClick={closeModal}>취소</button>
                  <button type="submit" className="save-button btn-primary" disabled={saving || !lookup_value_nm.trim() || !start_ymd || !end_ymd || Number.isNaN(parseInt(seq, 10)) || parseInt(seq, 10) < 0 || !isDateValid}>저장</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
