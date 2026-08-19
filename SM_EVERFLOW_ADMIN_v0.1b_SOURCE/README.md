# SM EVERFLOW ADMIN v0.1b

## 바로 실행
```bash
npm install
npm run dev
```
브라우저: http://localhost:3000

## 구현된 화면/기능
- 대시보드
- 상품·재고 검색
- 일본 매입/EMS 배치
- 플랫폼 관리
- 판매·정산 입력
- 금전·비용
- 빠른 현장매입
- LocalStorage DEMO 저장
- Excel XLSX 내보내기
- 모바일 반응형
- Supabase DB 연결용 SQL

## 현재 실제 데이터
- 상품 9점
- EMS 배치 3개
- 현재 확인비용 909,869원
- 1차결제 및 통관비는 아직 미반영

## GitHub → Vercel
1. GitHub Private Repository 생성
2. 이 폴더 전체 push
3. Vercel에서 GitHub repo Import
4. 자동 생성된 *.vercel.app 임시 도메인으로 사용
5. 추후 admin.smeverflow.kr 등 연결

## 온라인 2인 운영
V0.1b는 UI/운영 프로토타입이라 브라우저 LocalStorage를 사용합니다.
다음 단계에서 Supabase Auth + DB + Storage를 연결하면 두 사람이 동일 데이터를 사용하게 됩니다.
