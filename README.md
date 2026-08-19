# SM EVERFLOW ADMIN v0.2

실운영 전환 버전입니다.

## v0.2 핵심
- Supabase Auth 로그인
- 허용 ID: admin / jedilick / susan98302
- Supabase DB에서 상품·배치·판매·플랫폼·비용 실데이터 조회
- DEMO MODE 제거
- 상품 사진 업로드 (Supabase private Storage `product-images`)
- 모바일 카메라 촬영 입력
- 빠른 매입 시 사진 동시 등록
- 판매·정산 DB 저장
- Excel Export

## Supabase Auth 계정 3개 생성 (최초 1회)
Supabase Dashboard → Authentication → Users → Add user에서 아래 이메일 형태로 생성합니다.
- admin@smeverflow.com
- jedilick@smeverflow.com
- susan98302@smeverflow.com

각 비밀번호는 별도로 전달받은 값을 사용하세요. 소스코드에 비밀번호를 저장하지 않습니다.

## Vercel
기존 GitHub 저장소의 앱 폴더 내용을 이 버전으로 교체하면 main commit 후 자동 배포됩니다.

환경변수는 선택사항입니다(소스에 publishable fallback이 있음). 권장 설정:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Storage
`product-images`는 private bucket이며 authenticated 사용자만 접근합니다. 10MB 제한, jpeg/png/webp/heic/heif 허용.

V0.2 production deployment
