-- 공통코드 테이블 생성 (대분류/중분류)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

-- 대분류 (mr_lookup_type)
CREATE TABLE IF NOT EXISTS mr_lookup_type (
  lookup_type_id BIGSERIAL PRIMARY KEY,
  lookup_type_cd INTEGER NOT NULL,
  lookup_type_nm VARCHAR(100) NOT NULL
);

-- 중분류 (mr_lookup_value)
CREATE TABLE IF NOT EXISTS mr_lookup_value (
  lookup_value_id BIGSERIAL PRIMARY KEY,
  lookup_type_id BIGINT NOT NULL REFERENCES mr_lookup_type(lookup_type_id) ON DELETE CASCADE,
  lookup_value_cd INTEGER NOT NULL,
  lookup_value_nm VARCHAR(50) NOT NULL,
  remark VARCHAR(200),
  seq INTEGER,
  start_ymd VARCHAR(8),
  end_ymd VARCHAR(8),
  create_ymd VARCHAR(8)
);

CREATE INDEX IF NOT EXISTS idx_mr_lookup_value_type ON mr_lookup_value (lookup_type_id);
