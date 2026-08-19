-- SM EVERFLOW v0.6.0 guard: only warehouse-ready items may be converted into an international-shipping batch.
create or replace function public.create_batch_from_purchase_inbox(
  p_item_ids bigint[],
  p_batch_id text,
  p_batch_date date,
  p_tracking_no text default null,
  p_carrier text default 'EMS',
  p_bundle_no text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  r record;
  v_count int := 0;
  v_seq int;
  v_ym text := to_char(p_batch_date,'YYMM');
  v_product_id text;
  v_source text := '메루카리/Japan auction';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_item_ids is null or cardinality(p_item_ids)=0 then raise exception 'NO_ITEMS_SELECTED'; end if;
  if p_batch_id is null or btrim(p_batch_id)='' then raise exception 'BATCH_ID_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext('sm_everflow_product_id'));

  if exists(select 1 from public.batches where batch_id=p_batch_id) then
    raise exception 'BATCH_ID_ALREADY_EXISTS: %', p_batch_id;
  end if;

  if exists(
    select 1 from public.purchase_inbox
    where item_id=any(p_item_ids)
      and (converted_at is not null or product_id is not null or status='배치전환완료')
  ) then
    raise exception 'ALREADY_CONVERTED_ITEM_INCLUDED';
  end if;

  if (select count(*) from public.purchase_inbox where item_id=any(p_item_ids) and status in ('현지배송완료','대행창고보관','묶음배송선택','2차결제대기')) <> cardinality(p_item_ids) then
    raise exception 'ITEM_NOT_READY_FOR_BUNDLE_SHIPPING';
  end if;

  select count(*) into v_count from public.purchase_inbox where item_id=any(p_item_ids);

  insert into public.batches(
    batch_id,purchase_type,batch_date,source,bundle_no,tracking_no,status,carrier,
    expected_product_count,purchase_currency,purchase_amount_local,note
  )
  select
    p_batch_id,'일본경매직구',p_batch_date,v_source,p_bundle_no,p_tracking_no,
    case when coalesce(p_tracking_no,'')<>'' then '국제배송중' else '출고대기' end,
    p_carrier,v_count,'JPY',coalesce(sum(pure_item_price_jpy),0),p_note
  from public.purchase_inbox where item_id=any(p_item_ids);

  select coalesce(max((regexp_match(product_id,'-([0-9]{4})$'))[1]::int),0)
    into v_seq
  from public.products
  where product_id like ('SME-'||v_ym||'-%');

  for r in select * from public.purchase_inbox where item_id=any(p_item_ids) order by item_id loop
    v_seq := v_seq + 1;
    v_product_id := 'SME-'||v_ym||'-'||lpad(v_seq::text,4,'0');
    insert into public.products(
      product_id,batch_id,purchase_date,purchase_type,brand,category,product_name,
      inventory_status,logistics_status,source,auction_no,verified_cost,first_payment,total_cost,note
    ) values (
      v_product_id,p_batch_id,coalesce(r.purchase_at::date,p_batch_date),r.purchase_method,
      coalesce(nullif(r.brand,''),'미확인'),coalesce(nullif(r.category,''),'기타'),r.product_name,
      '입고전',case when coalesce(p_tracking_no,'')<>'' then '국제배송중' else '출고대기' end,
      v_source,r.auction_no,r.first_payment_krw,nullif(r.first_payment_krw,0),r.first_payment_krw,
      concat('Purchase Inbox #',r.external_id,case when r.source_note is not null then ' · '||r.source_note else '' end)
    );
    update public.purchase_inbox
       set status='배치전환완료',batch_id=p_batch_id,product_id=v_product_id,converted_at=now()
     where item_id=r.item_id;
  end loop;
  return jsonb_build_object('batch_id',p_batch_id,'product_count',v_count);
end; $$;

revoke all on function public.create_batch_from_purchase_inbox(bigint[],text,date,text,text,text,text) from public;
grant execute on function public.create_batch_from_purchase_inbox(bigint[],text,date,text,text,text,text) to authenticated;
