# SM EVERFLOW v0.5.1 BUILD FIX

원인:
- Supabase `.select().order()`가 반환하는 PostgREST query builder는 `await` 가능한 thenable(PromiseLike)이지만,
  v0.5.0의 retryQuery 인자가 `Promise<any>`로 너무 좁게 선언되어 Vercel TypeScript build가 실패함.

Vercel 오류:
- app/page.tsx:158:22
- PostgrestFilterBuilder ... is missing properties from type Promise<any>: catch, finally, Symbol.toStringTag

수정:
- `retryQuery(run:()=>Promise<any>)`
- → `retryQuery(run:()=>PromiseLike<any>)`

영향:
- DB schema 변경 없음
- 기존 9개 상품/3개 배치 데이터 변경 없음
- v0.5.0의 상품수정/다중사진/배치추가/플랫폼계정 기능 그대로 유지
