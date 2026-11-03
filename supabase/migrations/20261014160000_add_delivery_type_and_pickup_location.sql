alter table public.shipping_options
  add column if not exists delivery_type text not null default 'home'
    check (delivery_type in ('home', 'pickup'));

alter table public.orders
  add column if not exists delivery_type text not null default 'home'
    check (delivery_type in ('home', 'pickup')),
  add column if not exists pickup_location jsonb;

comment on column public.orders.pickup_location is
  'Buyer-selected collection point label, address and map coordinates. Shared with the seller and configured carrier for fulfilment.';
