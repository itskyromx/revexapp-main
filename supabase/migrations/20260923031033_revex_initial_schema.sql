-- ============================================================================
-- Revex — Supabase schema migrated from Base44 entities
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- PROFILES (replaces the Base44 "User" entity)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  display_name text,
  avatar text,
  bio text check (char_length(bio) <= 200),
  phone text,
  shipping_address text,
  private_account boolean not null default false,
  message_pref text not null default 'everyone' check (message_pref in ('everyone','following','nobody')),
  hide_from_search boolean not null default false,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "users update their own profile"
  on public.profiles for update using (auth.uid() = id);

create function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- POST -----------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  creator_name text,
  creator_avatar text,
  video_url text,
  image_urls text[] default '{}',
  caption text,
  haul_title text not null,
  tags text[] default '{}',
  category text not null default 'hauls'
    check (category in ('hauls','try_on','streetwear','vintage','y2k','cottagecore','luxury','other')),
  like_count int not null default 0,
  comment_count int not null default 0,
  view_count int not null default 0,
  share_count int not null default 0,
  bookmark_count int not null default 0,
  boost_expires_at timestamptz,
  item_ids uuid[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts are readable by everyone" on public.posts for select using (true);
create policy "owner manages own posts" on public.posts for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- ITEM -------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  post_id uuid references public.posts(id) on delete set null,
  seller_name text,
  seller_avatar text,
  title text not null,
  brand text,
  size text,
  condition text not null default 'good'
    check (condition in ('new_with_tags','like_new','good','fair')),
  price numeric not null,
  shipping_price numeric not null default 3,
  image_url text,
  try_on_video_url text,
  tags text[] default '{}',
  category text not null default 'tops'
    check (category in ('tops','bottoms','dresses','outerwear','shoes','accessories','other')),
  status text not null default 'available' check (status in ('available','reserved','sold')),
  accepts_offers boolean not null default true,
  bookmark_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.items enable row level security;
create policy "items are readable by everyone" on public.items for select using (true);
create policy "owner manages own items" on public.items for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- OFFER --------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  item_id uuid references public.items(id) on delete cascade,
  item_title text,
  item_image text,
  item_price numeric,
  seller_id uuid references auth.users(id) not null,
  buyer_id uuid references auth.users(id) not null,
  buyer_name text,
  initiator text not null default 'buyer' check (initiator in ('buyer','seller')),
  amount numeric not null,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create policy "buyer or seller read offer" on public.offers for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin());
create policy "buyer or seller manage offer" on public.offers for all
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin())
  with check (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin());

-- ORDER ----------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  item_id uuid references public.items(id),
  item_title text,
  item_image text,
  post_id uuid references public.posts(id),
  buyer_id uuid references auth.users(id) not null,
  buyer_name text,
  seller_id uuid references auth.users(id) not null,
  seller_name text,
  offer_id uuid references public.offers(id),
  item_price numeric not null,
  shipping_price numeric not null default 0,
  buyer_protection_fee numeric not null default 0,
  total numeric,
  shipping_option_id uuid,
  shipping_option_name text,
  shipping_address text,
  drop_off_point text,
  drop_off_instructions text,
  drop_off_code text,
  tracking_carrier text,
  tracking_number text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','in_transit','completed','cancelled')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  paid_date timestamptz,
  dropped_off_date timestamptz,
  completed_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "buyer or seller read order" on public.orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin());
create policy "buyer or seller update order" on public.orders for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin());
create policy "owner creates order" on public.orders for insert
  with check (auth.uid() = created_by_id);
create policy "admin deletes order" on public.orders for delete using (public.is_admin());

-- REVIEW -----------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  order_id uuid references public.orders(id) not null,
  item_id uuid references public.items(id),
  item_title text,
  seller_id uuid references auth.users(id) not null,
  seller_name text,
  buyer_id uuid references auth.users(id) not null,
  buyer_name text,
  buyer_avatar text,
  rating numeric not null check (rating between 1 and 5),
  comment text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  unique (order_id)
);
alter table public.reviews enable row level security;
create policy "reviews are readable by everyone" on public.reviews for select using (true);
create policy "buyer or admin delete review" on public.reviews for delete
  using (auth.uid() = buyer_id or public.is_admin());

-- FOLLOW -------------------------------------------------------------------
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  follower_id uuid references auth.users(id) not null,
  followee_id uuid references auth.users(id) not null,
  follower_name text,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id)
);
alter table public.follows enable row level security;
create policy "follows are readable by everyone" on public.follows for select using (true);
create policy "user manages own follows" on public.follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- BLOCK ------------------------------------------------------------------------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  blocker_id uuid references auth.users(id) not null,
  blocked_id uuid references auth.users(id) not null,
  blocked_name text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "involved users read block" on public.blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);
create policy "blocker creates block" on public.blocks for insert
  with check (auth.uid() = created_by_id);
create policy "blocker or admin deletes block" on public.blocks for delete
  using (auth.uid() = blocker_id or public.is_admin());
create policy "admin updates block" on public.blocks for update using (public.is_admin());

-- CHAT MESSAGE -------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  sender_id uuid references auth.users(id) not null,
  receiver_id uuid references auth.users(id) not null,
  sender_name text,
  text text not null,
  item_id uuid references public.items(id),
  item_title text,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "sender or receiver read message" on public.chat_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "sender inserts message" on public.chat_messages for insert
  with check (auth.uid() = sender_id);
create policy "sender deletes own message" on public.chat_messages for delete
  using (auth.uid() = sender_id);

-- CHAT READ ------------------------------------------------------------------
create table public.chat_reads (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  user_id uuid references auth.users(id) not null,
  other_id uuid references auth.users(id) not null,
  last_read_at timestamptz,
  unique (user_id, other_id)
);
alter table public.chat_reads enable row level security;
create policy "involved users read chat_reads" on public.chat_reads for select
  using (auth.uid() = user_id or auth.uid() = other_id);
create policy "user manages own chat_reads" on public.chat_reads for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- CHAT CLEAR -------------------------------------------------------------------
create table public.chat_clears (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  user_id uuid references auth.users(id) not null,
  other_id uuid references auth.users(id) not null,
  cleared_at timestamptz
);
alter table public.chat_clears enable row level security;
create policy "user manages own chat_clears" on public.chat_clears for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- NOTIFICATION -------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  recipient_id uuid references auth.users(id) not null,
  actor_id uuid references auth.users(id),
  actor_name text,
  actor_avatar text,
  thumbnail text,
  type text not null default 'message'
    check (type in ('message','offer','offer_accepted','sale','order','follow','like')),
  title text not null,
  body text,
  target_type text not null default 'inbox'
    check (target_type in ('item','chat','post','order','profile','inbox')),
  target_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "recipient reads own notifications" on public.notifications for select
  using (auth.uid() = recipient_id);
create policy "recipient updates own notifications" on public.notifications for update
  using (auth.uid() = recipient_id);
create policy "recipient deletes own notifications" on public.notifications for delete
  using (auth.uid() = recipient_id);

-- SAVED --------------------------------------------------------------------
create table public.saved (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  user_id uuid references auth.users(id) not null,
  kind text not null default 'item' check (kind in ('item','post')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);
alter table public.saved enable row level security;
create policy "user manages own saved" on public.saved for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- DRAFT ------------------------------------------------------------------------
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  haul_title text,
  caption text,
  tags text[] default '{}',
  category text default 'hauls',
  media jsonb default '[]',
  items jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.drafts enable row level security;
create policy "owner manages own drafts" on public.drafts for all
  using (auth.uid() = created_by_id) with check (auth.uid() = created_by_id);

-- REPORT ------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  target_type text not null default 'post' check (target_type in ('post','user')),
  post_id uuid references public.posts(id),
  haul_title text,
  haul_thumbnail text,
  reported_user_id uuid references auth.users(id),
  reported_user_name text,
  creator_id uuid references auth.users(id),
  creator_name text,
  reporter_id uuid references auth.users(id),
  reporter_name text,
  reason text not null default 'spam'
    check (reason in ('spam','inappropriate','harassment','misleading','other')),
  note text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  removal_rule text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "admin reads reports" on public.reports for select using (public.is_admin());
create policy "reporter creates report" on public.reports for insert
  with check (auth.uid() = created_by_id);
create policy "admin updates reports" on public.reports for update using (public.is_admin());
create policy "admin deletes reports" on public.reports for delete using (public.is_admin());

-- WARNING ------------------------------------------------------------------------
create table public.warnings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  user_id uuid references auth.users(id) not null,
  post_id uuid references public.posts(id),
  haul_title text,
  rule text not null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.warnings enable row level security;
create policy "user or admin reads own warnings" on public.warnings for select
  using (auth.uid() = user_id or public.is_admin());
create policy "admin creates warnings" on public.warnings for insert with check (public.is_admin());
create policy "user or admin updates warnings" on public.warnings for update
  using (auth.uid() = user_id or public.is_admin());
create policy "admin deletes warnings" on public.warnings for delete using (public.is_admin());

-- SHIPPING OPTION ----------------------------------------------------------
create table public.shipping_options (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) default auth.uid(),
  name text not null,
  carrier text,
  price numeric not null,
  eta_days text,
  drop_off_point text,
  drop_off_instructions text,
  active boolean not null default true
);
alter table public.shipping_options enable row level security;
create policy "shipping options are readable by everyone" on public.shipping_options for select using (true);
create policy "admin manages shipping options" on public.shipping_options for insert with check (public.is_admin());
create policy "admin updates shipping options" on public.shipping_options for update using (public.is_admin());
create policy "admin deletes shipping options" on public.shipping_options for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index on public.posts (created_at desc);
create index on public.items (post_id);
create index on public.offers (item_id);
create index on public.offers (buyer_id);
create index on public.offers (seller_id);
create index on public.orders (buyer_id);
create index on public.orders (seller_id);
create index on public.chat_messages (sender_id, receiver_id);
create index on public.chat_messages (receiver_id, sender_id);
create index on public.notifications (recipient_id, read);
create index on public.follows (follower_id);
create index on public.follows (followee_id);

-- ----------------------------------------------------------------------------
-- Storage bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

create policy "media is publicly readable" on storage.objects for select
  using (bucket_id = 'media');
create policy "authenticated users upload media" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "owners manage their own media" on storage.objects for update
  using (bucket_id = 'media' and owner = auth.uid());
create policy "owners delete their own media" on storage.objects for delete
  using (bucket_id = 'media' and owner = auth.uid());
