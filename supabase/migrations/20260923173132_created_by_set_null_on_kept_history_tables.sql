-- orders and reviews are kept forever as transaction history and are never
-- deleted by deleteAccount, so their created_by_id also needs to survive
-- the referenced auth user being removed.
alter table public.orders drop constraint orders_created_by_id_fkey, add constraint orders_created_by_id_fkey
  foreign key (created_by_id) references auth.users(id) on delete set null;
alter table public.reviews drop constraint reviews_created_by_id_fkey, add constraint reviews_created_by_id_fkey
  foreign key (created_by_id) references auth.users(id) on delete set null;
