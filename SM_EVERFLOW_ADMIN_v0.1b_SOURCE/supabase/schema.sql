-- SM EVERFLOW ADMIN v0.1b
-- Supabase SQL Editor에서 실행
create table if not exists products (
 product_id text primary key,
 batch_id text,
 purchase_date date not null,
 purchase_type text not null,
 brand text not null,
 category text not null,
 product_name text not null,
 inventory_status text not null,
 verified_cost numeric(14,0) not null default 0,
 total_cost numeric(14,0) not null default 0,
 ems text, bundle_no text, auction_no text,
 created_at timestamptz default now()
);
create table if not exists sales (
 sale_id text primary key,
 product_id text references products(product_id),
 channel text not null, sold_at date not null,
 gross numeric(14,0) not null default 0,
 fee numeric(14,0) not null default 0,
 shipping numeric(14,0) not null default 0,
 net numeric(14,0) not null default 0,
 created_at timestamptz default now()
);
alter table products enable row level security;
alter table sales enable row level security;
create policy "products_authenticated" on products for all to authenticated using (true) with check (true);
create policy "sales_authenticated" on sales for all to authenticated using (true) with check (true);
