-- Orders, offers and reviews keep the *name* of a buyer/seller as a plain
-- text snapshot already, so if the underlying account is deleted we can null
-- out the id reference instead of blocking the deletion or cascading it.
alter table public.orders alter column buyer_id drop not null;
alter table public.orders alter column seller_id drop not null;
alter table public.orders drop constraint orders_buyer_id_fkey, add constraint orders_buyer_id_fkey
  foreign key (buyer_id) references auth.users(id) on delete set null;
alter table public.orders drop constraint orders_seller_id_fkey, add constraint orders_seller_id_fkey
  foreign key (seller_id) references auth.users(id) on delete set null;

alter table public.offers alter column buyer_id drop not null;
alter table public.offers alter column seller_id drop not null;
alter table public.offers drop constraint offers_buyer_id_fkey, add constraint offers_buyer_id_fkey
  foreign key (buyer_id) references auth.users(id) on delete set null;
alter table public.offers drop constraint offers_seller_id_fkey, add constraint offers_seller_id_fkey
  foreign key (seller_id) references auth.users(id) on delete set null;

alter table public.reviews alter column buyer_id drop not null;
alter table public.reviews alter column seller_id drop not null;
alter table public.reviews drop constraint reviews_buyer_id_fkey, add constraint reviews_buyer_id_fkey
  foreign key (buyer_id) references auth.users(id) on delete set null;
alter table public.reviews drop constraint reviews_seller_id_fkey, add constraint reviews_seller_id_fkey
  foreign key (seller_id) references auth.users(id) on delete set null;

alter table public.chat_messages drop constraint chat_messages_sender_id_fkey, add constraint chat_messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete set null;
alter table public.chat_messages drop constraint chat_messages_receiver_id_fkey, add constraint chat_messages_receiver_id_fkey
  foreign key (receiver_id) references auth.users(id) on delete set null;

alter table public.notifications drop constraint notifications_recipient_id_fkey, add constraint notifications_recipient_id_fkey
  foreign key (recipient_id) references auth.users(id) on delete cascade;
alter table public.notifications drop constraint notifications_actor_id_fkey, add constraint notifications_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.reports drop constraint reports_reported_user_id_fkey, add constraint reports_reported_user_id_fkey
  foreign key (reported_user_id) references auth.users(id) on delete set null;
alter table public.reports drop constraint reports_creator_id_fkey, add constraint reports_creator_id_fkey
  foreign key (creator_id) references auth.users(id) on delete set null;
alter table public.reports drop constraint reports_reporter_id_fkey, add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;

alter table public.warnings drop constraint warnings_user_id_fkey, add constraint warnings_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.chat_reads drop constraint chat_reads_user_id_fkey, add constraint chat_reads_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.chat_reads drop constraint chat_reads_other_id_fkey, add constraint chat_reads_other_id_fkey
  foreign key (other_id) references auth.users(id) on delete cascade;

alter table public.saved drop constraint saved_user_id_fkey, add constraint saved_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
