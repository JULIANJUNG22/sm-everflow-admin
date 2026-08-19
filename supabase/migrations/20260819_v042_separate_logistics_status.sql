-- SM EVERFLOW v0.4.0 status model correction
-- Separate physical/logistics state from sales/inventory state.

alter table public.products add column if not exists logistics_status text not null default '입고완료';

update public.products p
set logistics_status=coalesce(b.status,'입고완료')
from public.batches b
where p.batch_id=b.batch_id;

update public.products
set inventory_status=case
  when logistics_status='입고완료' then '입고완료'
  else '입고전'
end
where inventory_status in ('매입완료','국제배송중','한국도착','통관중','통관완료','국내배송중','입고완료');

create or replace function public.sync_products_from_batch_status()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.status is not distinct from new.status then return new; end if;
  update public.products
     set logistics_status=new.status,
         received_at=case when new.status='입고완료' then coalesce(received_at,now()) else received_at end,
         inventory_status=case
           when new.status='입고완료' and inventory_status='입고전' then '입고완료'
           else inventory_status
         end,
         updated_at=now()
   where batch_id=new.batch_id and inventory_status not in ('판매완료','반품');
  return new;
end; $$;
