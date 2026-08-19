# SM EVERFLOW ADMIN v0.6.0

실운영 ERP-lite — 일본 구매대기(Purchase Inbox) 확장 버전.

## v0.6 핵심
- 일본 낙찰/즉결 구매 직후부터 회사 자산으로 추적
- `Purchase Inbox`: 국제배송 배치가 생기기 전 일본 현지 자산 관리
- 상태: 구매확정 → 1차결제완료 → 현지배송중 → 현지배송완료 → 대행창고보관 → 묶음배송선택 → 2차결제대기 → 배치전환완료
- 대행사이트 원문/Live Text/TSV 일괄 가져오기
- 구매대기 상품 다중 선택 → 국제배송 배치 + SME 상품ID 원자적 생성
- 묶음배송 배치 전환은 현지배송완료 이후 상품만 허용
- 대시보드에 일본 대기재고를 포함한 `추적 보유자산` 표시
- Excel Export에 `04_일본구매대기` 시트 추가
- 기존 v0.5.3 모바일/PWA/10장 사진/상품수정/플랫폼/판매/정산 기능 유지

## 현재 초기 데이터
2026-08-19 사용자가 제공한 MeruJG 화면을 기준으로 5개를 Purchase Inbox에 초기등록:
- 1차결제완료 2점
- 현지배송완료 3점

기존 국제배송/통관중 상품 9점과 합쳐 대시보드 추적 자산은 현재 14점이 됩니다.

## 배포
- GitHub `main` → Vercel 자동 배포
- Vercel Root Directory: `.` 유지
- Production Supabase migrations는 2026-08-19 이미 적용됨. 수동 SQL 재실행 불필요.

소스 이력용 migration files:
- `20260819_v060_purchase_inbox.sql`
- `20260819_v060b_purchase_inbox_guard.sql`
- `20260819_v060c_fk_indexes.sql`
