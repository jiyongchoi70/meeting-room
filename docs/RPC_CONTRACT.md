# RPC 계약서(초안)

## 목적
- Web/Flutter가 동일한 서버 검증 로직을 호출하도록 입출력 계약을 표준화한다.

## 공통 응답 형식
```json
{
  "ok": true,
  "message": "saved",
  "affected_ids": []
}
```

## 1) `rpc_save_reservation`
- 용도: 신규/수정(single/this/all) 저장 통합
- 입력(예시)
```json
{
  "actor_uid": "user_uid",
  "scope": "single|this|all",
  "target_reservation_id": "uuid-or-null",
  "payload": {
    "title": "string",
    "room_id": "uuid",
    "allday_yn": "Y|N",
    "start_ymd": "ISO",
    "end_ymd": "ISO",
    "repeat_id": 120,
    "repeat_end_ymd": "YYYYMMDD"
  }
}
```

## 2) `rpc_move_reservation`
- 용도: 드래그/리사이즈 이동(this/all) 처리
- 입력(예시)
```json
{
  "actor_uid": "user_uid",
  "scope": "this|all",
  "target_reservation_id": "uuid",
  "new_start_ymd": "ISO",
  "new_end_ymd": "ISO"
}
```

## 3) `rpc_change_reservation_status`
- 용도: 한 예약을 앵커로 승인(120) / 반려(130) 처리만. `scope=all`이면 동일 `repeat_group_id` 시리즈 전체(같은 회의실·동일 전이 가능 상태일 때만). 완료(140)는 예약 저장 시 자동 부여만(본 RPC 미사용).
- Supabase RPC 파라미터(스네이크 케이스)

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `p_actor_uid` | text | 로그인 사용자 UID (Auth `sub`) |
| `p_target_reservation_id` | uuid | 앵커 예약 ID |
| `p_next_status` | int | `120` 승인, `130` 반려 |
| `p_scope` | text | `this` \| `all` (기본 `this`) |
| `p_return_comment` | text? | 반려(130) 시 사유(선택). 승인 시 `return_comment`는 NULL로 정리 |

- 응답 행 1건: `ok`, `message`, `affected_count`, `affected_ids` (uuid 배열)

## 3b) `rpc_change_reservation_status_many`
- 용도: 서로 무관한 예약 ID 여러 개를 각각 단건 갱신(예: 예약현황 그리드 다중 선택). **시리즈 자동 확장 없음.**
- 파라미터: `p_actor_uid`, `p_reservation_ids` (uuid[]), `p_next_status`, `p_return_comment`
- 응답: 위와 동일 형식 (`affected_ids` = 실제 갱신된 ID 목록)

## 오류 코드 권장
- `E_NOT_OWNER`: 본인 예약 아님
- `E_NOT_APPROVER`: 승인 권한 없음
- `E_OVERLAP`: 중복 발생
- `E_INVALID_SCOPE`: 잘못된 scope
- `E_INVALID_STATE`: 상태 전이 불가
- `E_NOT_FOUND`: 대상 없음
