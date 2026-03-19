-- ============================================================
-- 회의실 예약 시스템 + 공통코드 관리 — 전체 DDL (PostgreSQL)
-- 실행: Supabase SQL Editor 또는 psql에서 실행
-- ============================================================

-- ------------------------------------------------------------
-- 1. 회의실 마스터 (meeting_rooms)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  capacity   INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE meeting_rooms IS '회의실 마스터';
COMMENT ON COLUMN meeting_rooms.id IS 'PK, UUID 자동 생성';
COMMENT ON COLUMN meeting_rooms.name IS '회의실명';
COMMENT ON COLUMN meeting_rooms.capacity IS '수용 인원';

-- ------------------------------------------------------------
-- 2. 예약 (reservations)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  start_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ NOT NULL,
  room_id    UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
  booker     TEXT,
  is_all_day BOOLEAN DEFAULT false,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_reservations_room  ON reservations (room_id);

COMMENT ON TABLE reservations IS '회의실 예약';
COMMENT ON COLUMN reservations.room_id IS 'FK → meeting_rooms.id';
COMMENT ON COLUMN reservations.start_at IS '시작 시각 (ISO 타임존 포함)';
COMMENT ON COLUMN reservations.end_at   IS '종료 시각 (ISO 타임존 포함)';

-- ------------------------------------------------------------
-- 3. 공통코드 — 대분류 (mr_lookup_type)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_lookup_type (
  lookup_type_id BIGSERIAL PRIMARY KEY,
  lookup_type_cd INTEGER NOT NULL,
  lookup_type_nm VARCHAR(100) NOT NULL
);

COMMENT ON TABLE mr_lookup_type IS '공통코드 대분류';
COMMENT ON COLUMN mr_lookup_type.lookup_type_cd IS '코드 (화면 표시용)';
COMMENT ON COLUMN mr_lookup_type.lookup_type_nm IS '구분명';

-- ------------------------------------------------------------
-- 4. 공통코드 — 중분류 (mr_lookup_value)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_lookup_value (
  lookup_value_id BIGSERIAL PRIMARY KEY,
  lookup_type_id  BIGINT NOT NULL REFERENCES mr_lookup_type(lookup_type_id) ON DELETE CASCADE,
  lookup_value_cd INTEGER NOT NULL,
  lookup_value_nm VARCHAR(50) NOT NULL,
  remark         VARCHAR(200),
  seq            INTEGER,
  start_ymd       VARCHAR(8),
  end_ymd         VARCHAR(8),
  create_ymd      VARCHAR(8)
);

CREATE INDEX IF NOT EXISTS idx_mr_lookup_value_type ON mr_lookup_value (lookup_type_id);

COMMENT ON TABLE mr_lookup_value IS '공통코드 중분류';
COMMENT ON COLUMN mr_lookup_value.lookup_type_id IS 'FK → mr_lookup_type.lookup_type_id';
COMMENT ON COLUMN mr_lookup_value.lookup_value_cd IS '코드 (화면 표시용)';
COMMENT ON COLUMN mr_lookup_value.lookup_value_nm IS '구분명';
COMMENT ON COLUMN mr_lookup_value.seq IS '표시 순서';
COMMENT ON COLUMN mr_lookup_value.start_ymd IS '시작일 (YYYYMMDD)';
COMMENT ON COLUMN mr_lookup_value.end_ymd   IS '종료일 (YYYYMMDD)';
COMMENT ON COLUMN mr_lookup_value.create_ymd IS '생성일 (YYYYMMDD)';

-- ------------------------------------------------------------
-- 5. 사용자 (mr_users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_users (
  user_uid     VARCHAR(50) PRIMARY KEY,
  user_name    VARCHAR(50),
  user_position INTEGER,
  email        VARCHAR(80),
  phone        VARCHAR(30),
  user_type    INTEGER,
  "join"       INTEGER,
  remark       VARCHAR(200),
  create_ymd   VARCHAR(8),
  update_ymd   VARCHAR(8),
  update_user  VARCHAR(50)
);

COMMENT ON TABLE mr_users IS '사용자';
COMMENT ON COLUMN mr_users.user_uid IS 'Authentication users의 UID (PK)';
COMMENT ON COLUMN mr_users.user_name IS '성명';
COMMENT ON COLUMN mr_users.user_position IS '직분';
COMMENT ON COLUMN mr_users.email IS '이메일';
COMMENT ON COLUMN mr_users.phone IS '전화번호';
COMMENT ON COLUMN mr_users.user_type IS '사용자구분';
COMMENT ON COLUMN mr_users."join" IS '가입/탈퇴';
COMMENT ON COLUMN mr_users.remark IS '비고';
COMMENT ON COLUMN mr_users.create_ymd IS '생성일 (YYYYMMDD)';
COMMENT ON COLUMN mr_users.update_ymd IS '수정일 (YYYYMMDD)';
COMMENT ON COLUMN mr_users.update_user IS '최종 수정자 UID (로그인 사용자)';

-- 기존 mr_users 테이블에 update_user 컬럼이 없으면 추가 (마이그레이션)
ALTER TABLE mr_users ADD COLUMN IF NOT EXISTS update_user VARCHAR(50);
COMMENT ON COLUMN mr_users.update_user IS '최종 수정자 UID (로그인 사용자)';

-- ------------------------------------------------------------
-- 회의실 관리 (mr_room) — 예약가능일·승인여부·중복여부 등
-- 공통코드: duplicate_yn, confirm_yn → lookup_type_cd 120
--         reservation_available → lookup_type_cd 150
--         (170일 때 reservation_ymd에 특정일 YYYYMMDD 저장)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_room (
  room_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_nm              VARCHAR(100) NOT NULL,
  duplicate_yn         INTEGER,
  reservation_available INTEGER,
  reservation_ymd      VARCHAR(8),
  reservation_cnt      INTEGER,
  confirm_yn           INTEGER,
  cnt                  INTEGER,
  remark               VARCHAR(300),
  seq                  INTEGER,
  create_ymd           VARCHAR(8),
  update_ymd            VARCHAR(8)
);

COMMENT ON TABLE mr_room IS '회의실 관리';
COMMENT ON COLUMN mr_room.room_id IS 'PK';
COMMENT ON COLUMN mr_room.room_nm IS '회의실명';
COMMENT ON COLUMN mr_room.duplicate_yn IS '중복가능여부 (lookup 120)';
COMMENT ON COLUMN mr_room.reservation_available IS '예약가능일 정책 (lookup 150, 110=현재일로부터 N일, 170=특정일)';
COMMENT ON COLUMN mr_room.reservation_ymd IS '예약가능 특정일 YYYYMMDD (reservation_available=170일 때)';
-- reservation_cnt: 현재일로부터 예약가능 일수 (reservation_available=110일 때 사용, 필수)
ALTER TABLE mr_room ADD COLUMN IF NOT EXISTS reservation_cnt INTEGER;
COMMENT ON COLUMN mr_room.reservation_cnt IS '예약가능 일수 (reservation_available=110일 때, 현재일로부터 N일)';
COMMENT ON COLUMN mr_room.confirm_yn IS '승인여부 (lookup 120)';
COMMENT ON COLUMN mr_room.cnt IS '인원수';
COMMENT ON COLUMN mr_room.remark IS '비고';
COMMENT ON COLUMN mr_room.seq IS '표시 순서';
COMMENT ON COLUMN mr_room.create_ymd IS '생성일 YYYYMMDD';
COMMENT ON COLUMN mr_room.update_ymd IS '수정일 YYYYMMDD';

-- ------------------------------------------------------------
-- 회의실별 승인자 (mr_approver)
-- 승인자 표시: user_name 오름차순 첫 번째 → "김일동 외 1명"
-- 승인자 없으면 빈칸 (승인여부와 무관)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_approver (
  approver_id  BIGSERIAL PRIMARY KEY,
  room_id      UUID NOT NULL REFERENCES mr_room(room_id) ON DELETE CASCADE,
  user_uid     VARCHAR(50) NOT NULL REFERENCES mr_users(user_uid) ON DELETE CASCADE,
  UNIQUE(room_id, user_uid)
);

CREATE INDEX IF NOT EXISTS idx_mr_approver_room ON mr_approver (room_id);
CREATE INDEX IF NOT EXISTS idx_mr_approver_user ON mr_approver (user_uid);

COMMENT ON TABLE mr_approver IS '회의실별 승인자';
COMMENT ON COLUMN mr_approver.approver_id IS 'PK';
COMMENT ON COLUMN mr_approver.room_id IS 'FK → mr_room.room_id';
COMMENT ON COLUMN mr_approver.user_uid IS 'FK → mr_users.user_uid';

-- ------------------------------------------------------------
-- 예약 (mr_reservations) — 결재·반복 포함 (기존 reservations 미사용)
-- 결재상태: lookup 180 (100=신청, 110=승인, 120=반려)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mr_reservations (
  reservation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(100) NOT NULL,
  room_id         UUID NOT NULL REFERENCES mr_room(room_id) ON DELETE CASCADE,
  allday_yn       VARCHAR(1) DEFAULT 'N',
  start_ymd       TIMESTAMPTZ NOT NULL,
  end_ymd         TIMESTAMPTZ NOT NULL,
  repeat_id       VARCHAR(100),
  repeat_end_ymd  VARCHAR(8),
  repeat_cycle    INTEGER,
  repeat_user     VARCHAR(100),
  sun_yn          VARCHAR(1) DEFAULT 'N',
  mon_yn          VARCHAR(1) DEFAULT 'N',
  tue_yn          VARCHAR(1) DEFAULT 'N',
  wed_yn          VARCHAR(1) DEFAULT 'N',
  thu_yn          VARCHAR(1) DEFAULT 'N',
  fri_yn          VARCHAR(1) DEFAULT 'N',
  sat_yn          VARCHAR(1) DEFAULT 'N',
  repeat_condition VARCHAR(30),
  status          INTEGER,
  approver        VARCHAR(50) REFERENCES mr_users(user_uid) ON DELETE SET NULL,
  return_comment  VARCHAR(500),
  create_user     VARCHAR(50) NOT NULL REFERENCES mr_users(user_uid) ON DELETE CASCADE,
  create_at       TIMESTAMPTZ DEFAULT now(),
  update_at       TIMESTAMPTZ DEFAULT now()
);

-- (기존 DB에 컬럼 추가 시) ALTER TABLE mr_reservations ADD COLUMN IF NOT EXISTS return_comment VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_mr_reservations_room   ON mr_reservations (room_id);
CREATE INDEX IF NOT EXISTS idx_mr_reservations_dates  ON mr_reservations (start_ymd, end_ymd);
CREATE INDEX IF NOT EXISTS idx_mr_reservations_user   ON mr_reservations (create_user);
CREATE INDEX IF NOT EXISTS idx_mr_reservations_status ON mr_reservations (status);

COMMENT ON TABLE mr_reservations IS '회의실 예약 (결재·반복 포함)';
COMMENT ON COLUMN mr_reservations.reservation_id IS 'PK';
COMMENT ON COLUMN mr_reservations.status IS '결재상태 (lookup 180: 100=신청, 110=승인, 120=반려)';
COMMENT ON COLUMN mr_reservations.approver IS '승인자 user_uid';
COMMENT ON COLUMN mr_reservations.create_user IS '신청자 user_uid';

-- ------------------------------------------------------------
-- (선택) 회의실 예약 반복 옵션 — lookup_type_cd 160
-- 회의실 예약 모달의 "반복" 드롭다운: 반복없음(100), 매일(110), 매주(120), 매월(130)
-- ------------------------------------------------------------
INSERT INTO mr_lookup_type (lookup_type_cd, lookup_type_nm)
SELECT 160, '반복'
WHERE NOT EXISTS (SELECT 1 FROM mr_lookup_type WHERE lookup_type_cd = 160);

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 100, '반복없음', 1
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 160
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 160 AND v.lookup_value_cd = 100
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 110, '매일', 2
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 160
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 160 AND v.lookup_value_cd = 110
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 120, '매주', 3
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 160
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 160 AND v.lookup_value_cd = 120
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 130, '매월', 4
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 160
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 160 AND v.lookup_value_cd = 130
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 150, '사용자 설정', 5
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 160
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 160 AND v.lookup_value_cd = 150
  );

-- ------------------------------------------------------------
-- 반복 주기 단위 (lookup_type_cd 170) — 반복 사용자 설정 모달 드롭다운
-- current_date between start_ymd and end_ymd 로 유효한 값만 조회
-- ------------------------------------------------------------
INSERT INTO mr_lookup_type (lookup_type_cd, lookup_type_nm)
SELECT 170, '반복주기'
WHERE NOT EXISTS (SELECT 1 FROM mr_lookup_type WHERE lookup_type_cd = 170);

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 1, '일', 1
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 170
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 170 AND v.lookup_value_cd = 1
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 2, '주', 2
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 170
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 170 AND v.lookup_value_cd = 2
  );

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 3, '월', 3
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 170
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 170 AND v.lookup_value_cd = 3
  );

-- ------------------------------------------------------------
-- 결재상태 (lookup_type_cd 180) — 예약현황 필터·그리드
-- 100=신청, 110=승인, 120=반려
-- ------------------------------------------------------------
INSERT INTO mr_lookup_type (lookup_type_cd, lookup_type_nm)
SELECT 180, '결재상태'
WHERE NOT EXISTS (SELECT 1 FROM mr_lookup_type WHERE lookup_type_cd = 180);

INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 100, '신청', 1
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 180
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 180 AND v.lookup_value_cd = 100
  );
INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 110, '승인', 2
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 180
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 180 AND v.lookup_value_cd = 110
  );
INSERT INTO mr_lookup_value (lookup_type_id, lookup_value_cd, lookup_value_nm, seq)
SELECT t.lookup_type_id, 120, '반려', 3
FROM mr_lookup_type t
WHERE t.lookup_type_cd = 180
  AND NOT EXISTS (
    SELECT 1 FROM mr_lookup_value v
    INNER JOIN mr_lookup_type t2 ON v.lookup_type_id = t2.lookup_type_id
    WHERE t2.lookup_type_cd = 180 AND v.lookup_value_cd = 120
  );