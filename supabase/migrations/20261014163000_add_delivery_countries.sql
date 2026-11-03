alter table public.shipping_options
  add column if not exists supported_countries text[] not null default array['Portugal', 'Spain']::text[];

alter table public.orders
  add column if not exists delivery_country text not null default 'Portugal'
    check (delivery_country in ('Portugal', 'Spain'));
