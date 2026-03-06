# 회의실 예약

Vite + React 기반 회의실 예약 시스템입니다.

## 로컬에서 실행하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정 (선택)

Supabase(로그인·회원가입 등)를 사용하려면 프로젝트 루트에 `.env` 파일을 만듭니다.

```bash
# .env.example을 복사한 뒤 값을 채움
copy .env.example .env
```

`.env` 예시:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Supabase 없이 실행해도 화면은 동작하며, 로그인/회원가입 시 안내 메시지가 표시됩니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

또는

```bash
npm start
```

브라우저에서 **http://localhost:5173** 으로 접속합니다.

### 4. 빌드 (배포용)

```bash
npm run build
```

결과물은 `dist/` 폴더에 생성됩니다.

### 5. 빌드 결과 미리보기

```bash
npm run preview
```

---

## 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` / `npm start` | 로컬 개발 서버 실행 (http://localhost:5173) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run deploy` | 빌드 후 Firebase Hosting 배포 |
