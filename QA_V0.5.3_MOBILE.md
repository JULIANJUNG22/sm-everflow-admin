# SM EVERFLOW v0.5.3 — Mobile UX / Responsive Patch

목표: iPhone PWA에서 상단 메뉴와 주요 조작이 손가락으로 정확히 눌리도록 수정.

## 수정
- iOS PWA status bar `black-translucent` → `default`
- Dynamic Island / status bar safe-area 반영
- 모바일 메뉴 버튼 48px 터치 영역
- 상단 Refresh / Excel / 빠른매입 44px 아이콘형 버튼
- 사이드 메뉴 폭 확대 및 항목 높이 50px
- 모든 주요 버튼 최소 44~50px
- 입력폼 16px / 48px: iOS 입력 시 자동 확대 방지
- 상품 수정 Modal을 모바일 full-screen sheet로 최적화
- 닫기 48px, 하단 저장 영역 sticky
- 사진 앨범/촬영 버튼 2열 50px
- 모바일 상품 목록: 불필요한 원가/배치/플랫폼/사진 열 숨김
  (상세 데이터는 행 1회 탭으로 여전히 접근)
- 배치 액션 모바일 2열/전체폭 배치
- safe-area bottom 적용

## 데이터/DB
- DB schema 변경 없음
- 기존 상품/배치/사진/플랫폼 데이터 변경 없음
