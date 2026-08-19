-- SM EVERFLOW v0.6.0 low-risk FK index hardening
create index if not exists products_batch_id_idx on public.products(batch_id);
create index if not exists expenses_batch_id_idx on public.expenses(batch_id);
create index if not exists sales_product_id_idx on public.sales(product_id);
