# 회의실 예약 시스템 (메인 화면)

로그인/DB 없이 **메인 화면만** 동작하는 데모입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 구현 내용

- **좌측 사이드바**: "회의실 예약" 제목, **+ 만들기** 버튼, **미니 캘린더** (월 이동, 날짜 클릭 시 메인 캘린더 해당 월로 이동)
- **메인 캘린더**: FullCalendar 월/주/일 뷰, **오늘**·이전/다음 네비게이션
- **이벤트 표시**: 목업 데이터(2026년 2월)로 회의/연차/휴일 등 표시 (시간 + 회의실 + 제목)
- **날짜 클릭**: 해당 날짜로 예약 모달 열기
- **이벤트 클릭**: 해당 예약 수정 모달 열기
- **예약 모달**: 제목, 시작/종료 일·시, 종일, 회의실 선택, 저장 (메모리 상태만 저장, 새로고침 시 초기화)

## 기술 스택

- React 18 + TypeScript
- Vite
- FullCalendar (dayGrid, timeGrid, interaction)
- 목업 데이터 (mockData.ts)

## 이후 연동 예정

- Supabase (PostgreSQL, Auth)
- Firebase Hosting 배포
- Resend 메일
