# SM EVERFLOW ADMIN v0.4.0

실운영용 전환 버전.

## 이번 버전의 핵심
- **물류 상태와 판매/재고 상태를 분리**
  - 물류: 매입완료 → 국제배송중 → 한국도착 → 통관중 → 통관완료 → 국내배송중 → 입고완료
  - 판매/재고: 입고전 → 입고완료 → 촬영대기 → 판매중 → 예약 → 판매완료 / 반품 / 보류
- **배치 상태를 바꾸면 연결 상품의 물류 상태 자동 동기화**
- **입고완료 시 입고전 상품은 자동 입고완료**
- **플랫폼 판매중 등록 시 상품 판매상태 자동 판매중**
- **판매 입력 시 상품 판매완료 + 연결 플랫폼 판매종료**
- **상태 변경 이력 자동 기록**
- **상품 추가/수정, 배치 추가/수정, 플랫폼 등록/상태변경/삭제, 판매/정산, 비용 등록/삭제**
- **배치 공통비 균등/원가비례 배부**
- **사진 업로드**
- **JWT 시각 오류 1회 자동 재시도 + 일부 DB 오류 시 전체 화면이 비지 않도록 개선**
- **Excel Export에 상태이력 포함**
- **PWA/iPhone 홈화면 앱 유지**

## 운영 DB
2026-08-19 기준 production DB에 v0.4 migration이 이미 적용되어 있습니다.
현재 JP-AUC-2608-01/02/03 배치는 실제 상황에 맞춰 `통관중`으로 변경되어 있습니다.

## GitHub 업로드
압축 해제 후 이 폴더 안의 **내용물**을 `JULIANJUNG22/sm-everflow-admin` 저장소 루트에 덮어씁니다.

필수 교체:
- app/page.tsx
- app/globals.css
- app/layout.tsx
- lib/supabase.ts
- package.json
- tsconfig.json
- next-env.d.ts

유지/포함:
- public/manifest.webmanifest
- public/icon-192.png
- public/icon-512.png
- public/apple-touch-icon.png
- supabase/migrations/*

Commit:
`SM EVERFLOW v0.4.0 operational workflow`

Vercel Root Directory는 `.` 그대로 유지합니다.

## 배포 직후 확인
1. 로그인
2. 매입·수입에서 3개 배치가 `통관중`인지 확인
3. 임의 배치 상태를 변경하기 전에는 실제 상황과 일치하는지 확인
4. 사진 1장 업로드
5. 테스트 상품 1개 등록
6. 플랫폼 등록
7. 판매/정산 테스트
8. Excel Export

## 원가 배부 주의
현재 일본 경매의 2차 결제 금액에 국제배송료·대행수수료 등이 포함된 경우,
같은 비용을 배치 공통비에 중복 입력하면 완전원가가 과대계상됩니다.
v0.4의 자동 공통비 배부는 `관세 + 수입VAT + 통관수수료 + 국내배송 + 출장/체재 + 기타 + 배치연결 관리비용`을 중심으로 사용하십시오.
