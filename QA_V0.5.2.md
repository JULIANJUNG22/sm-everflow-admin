# SM EVERFLOW v0.5.2 BUILD FIX

Vercel v0.5.1 build error:
- app/page.tsx:520:299
- Parameter `id` implicitly has an `any` type.

원인:
- Dashboard / InventoryView / PurchasesView / PlatformsView가 `props:any`를 사용하고 있어,
  부모 JSX에서 전달하는 inline callback의 `id`에 contextual type이 전달되지 않았음.

수정한 callback 5곳:
- Dashboard onBatch `(id:string)`
- InventoryView onEdit `(id:string)`
- PurchasesView onEdit `(id:string)`
- PurchasesView onAddProduct `(id:string)`
- PlatformsView onEditAccount `(id:string)`

추가:
- 화면 VERSION 0.5.2
- package.json version 0.5.2
- DB/schema 변경 없음
