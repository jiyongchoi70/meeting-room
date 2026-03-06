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

-- ============================================================
-- 끝
-- ============================================================
