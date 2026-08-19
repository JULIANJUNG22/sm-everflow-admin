# SM EVERFLOW v0.6.0 QA REPORT

검증일: 2026-08-19

## 1. Production DB
- 기존 products: 9 — 유지
- 기존 batches: 3 — 유지
- 기존 통관중 products: 9 — 유지
- 신규 purchase_inbox: 5
  - 1차결제완료: 2
  - 현지배송완료: 3
- 신규 Purchase Inbox 1차결제 합계: KRW 240,944
- 신규 Purchase Inbox 순수물품대금 합계: JPY 19,600

## 2. DB Migration / Workflow QA
PASS
- `purchase_inbox` table / RLS / indexes 생성
- 상태변경 history → `status_events` 기록 trigger 구성
- 현지배송완료 이후 상품만 묶음배송 배치 전환 가능하도록 guard 구성
- 선택 Purchase Inbox → Batch + Products 원자적 생성 RPC 구성
- 자동 SME 상품ID 생성 구성
- tracking no 존재 시 국제배송중, 미존재 시 출고대기 생성

Transaction QA 후 ROLLBACK 검증:
- 임시 ready item → 임시 batch `출고대기`
- product 1개 생성
- inbox `배치전환완료` + batch/product 연결
- rollback 후 QA batch/product/inbox 잔존 0건 확인

## 3. Front-end static QA
PASS
- TypeScript/TSX parser diagnostics: 0 (`tsc --noEmit --noCheck`)
- `{}`, `()`, `[]` 균형 확인
- v0.5에서 실제 Vercel 오류를 냈던 Supabase builder 타입은 `PromiseLike<any>` 유지
- 부모 custom callback id / ids parameter는 명시적 string / string[] 타입 유지
- v0.5.3 모바일 safe-area / touch UX CSS 유지

## 4. Import parser QA
PASS
- MeruJG `고유번호` 기반 다건 블록 분리
- 상태 header 추론
- 경매번호 / 결제금액 / JPY / 현지배송일 / 중량 추출
- TSV fallback parsing
- 동일 source_system + external_id는 upsert로 중복 방지

## 5. Production 배포 후 확인 항목
Vercel에서 실제 dependency를 설치한 Next.js production build는 GitHub 업로드 후 자동 실행됩니다.
로컬 컨테이너에서는 npm registry DNS 접근이 차단되어 `npm install` 기반 동일 build를 재현할 수 없었습니다.
배포 후 확인:
1. Vercel `Ready`
2. Dashboard 추적 보유자산 14점
3. 매입·수입 → 일본 구매대기함 5점
4. 일괄 가져오기 Modal
5. 현지배송완료 상품 체크 → 묶음배송 배치 생성
6. Excel `04_일본구매대기`
