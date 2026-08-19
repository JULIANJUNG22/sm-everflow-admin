# SM EVERFLOW v0.4.0 QA

검증일: 2026-08-19

## Production DB 검증
- products: 9
- batches: 3
- 현재 3개 배치: 통관중
- 현재 9개 상품 logistics_status: 통관중
- 현재 9개 상품 inventory_status: 입고전
- 중복 product_id: 0
- 필수 필드 누락: 0
- 음수 원가: 0

## 자동화 트랜잭션 테스트
1. 배치 `통관중 → 통관완료`
   - 연결 상품 logistics_status 자동 `통관완료`
   - customs_cleared_at 자동 기록
   - 테스트 후 ROLLBACK

2. 배치 `통관중 → 입고완료`
   - 연결 상품 logistics_status 자동 `입고완료`
   - inventory_status `입고전 → 입고완료`
   - received_at 자동 기록
   - 테스트 후 ROLLBACK

3. 플랫폼 판매중 등록
   - 상품 inventory_status 자동 `판매중`

4. 판매 입력
   - 상품 inventory_status 자동 `판매완료`
   - sold_price 자동 기록
   - 활성 플랫폼 등록 자동 `판매종료`
   - 테스트 후 ROLLBACK

## 소스 검증
- app/page.tsx TypeScript/TSX parser syntax diagnostics: 0
- PWA manifest / Apple touch icon 포함

## 배포 후 실제 브라우저 테스트가 필요한 항목
- iPhone 사진 촬영 → Supabase Storage 업로드
- 플랫폼 URL 열기
- Excel 다운로드
- 실제 정산 입력
- 배치 공통비 배부
