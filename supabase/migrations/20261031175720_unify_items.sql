-- Canonical item model. Preserve existing item IDs and a private snapshot of
-- the former posts table. Legacy views/RPCs are adapters, never a second store.
begin;
set local lock_timeout = '5s';
lock table public.posts, public.items, public.saved, public.post_likes, public.post_shares in share row exclusive mode;
do $$ begin
  if exists (select 1 from public.posts p left join public.items i on i.post_id=p.id group by p.id having count(i.id) <> 1) then
    raise exception 'Migration requires exactly one item per legacy post; reconcile these records first';
  end if;
  if exists (select 1 from public.posts p join public.items i on i.post_id=p.id where i.created_by_id is distinct from p.created_by_id) then
    raise exception 'Mismatched item/post owners';
  end if;
end $$;

alter table public.items add column image_urls text[] not null default '{}',
  add column like_count integer not null default 0,
  add column comment_count integer not null default 0,
  add column view_count integer not null default 0,
  add column share_count integer not null default 0,
  add column boost_expires_at timestamptz,
  add column boost_payment_ids text[] not null default '{}';
update public.items i set image_urls=case when cardinality(p.image_urls)>0 then p.image_urls else array_remove(array[i.image_url],null) end,
  like_count=p.like_count, comment_count=p.comment_count, view_count=p.view_count,
  share_count=p.share_count, boost_expires_at=p.boost_expires_at
from public.posts p where p.id=i.post_id;
update public.items set image_urls=array[image_url] where cardinality(image_urls)=0 and nullif(image_url,'') is not null;

-- Repoint relations before moving the former table out of the public API.
alter table public.items drop constraint items_post_id_fkey;
create unique index items_legacy_post_id_unique on public.items(post_id) where post_id is not null;
comment on column public.items.post_id is 'Legacy URL alias only. Canonical identity is items.id; no separate post exists.';
alter table public.orders drop constraint orders_post_id_fkey;
alter table public.reports drop constraint reports_post_id_fkey;
alter table public.warnings drop constraint warnings_post_id_fkey;
alter table public.post_likes drop constraint post_likes_post_id_fkey;
alter table public.post_shares drop constraint post_shares_post_id_fkey;

update public.post_likes l set post_id=i.id from public.items i where i.post_id=l.post_id;
update public.post_shares s set post_id=i.id from public.items i where i.post_id=s.post_id;
update public.reports r set post_id=i.id from public.items i where i.post_id=r.post_id;
update public.warnings w set post_id=i.id from public.items i where i.post_id=w.post_id;
alter table public.post_likes rename to item_likes;
alter table public.item_likes rename column post_id to item_id;
alter table public.post_shares rename to item_shares;
alter table public.item_shares rename column post_id to item_id;
alter table public.item_likes add constraint item_likes_item_id_fkey foreign key(item_id) references public.items(id) on delete cascade;
alter table public.item_shares add constraint item_shares_item_id_fkey foreign key(item_id) references public.items(id) on delete cascade;
alter table public.reports rename column post_id to item_id;
alter table public.reports rename column haul_title to item_title;
alter table public.reports rename column haul_thumbnail to item_thumbnail;
alter table public.reports add constraint reports_item_id_fkey foreign key(item_id) references public.items(id) on delete set null;
alter table public.reports drop constraint reports_target_type_check;
update public.reports set target_type='item' where target_type='post';
alter table public.reports alter column target_type set default 'item';
alter table public.reports add constraint reports_target_type_check check(target_type in ('item','user'));
alter table public.warnings rename column post_id to item_id;
alter table public.warnings rename column haul_title to item_title;
alter table public.warnings add constraint warnings_item_id_fkey foreign key(item_id) references public.items(id) on delete set null;
alter table public.chat_messages drop constraint chat_messages_item_id_fkey;
alter table public.chat_messages add constraint chat_messages_item_id_fkey foreign key(item_id) references public.items(id) on delete set null;

-- Saving a listing and saving its former haul become one bookmark.
delete from public.saved s using public.items i, public.saved existing
where s.kind='post' and s.target_id=i.post_id and existing.kind='item'
  and existing.target_id=i.id and existing.user_id=s.user_id;
update public.saved s set kind='item',target_id=i.id from public.items i where s.kind='post' and s.target_id=i.post_id;
update public.items i set bookmark_count=(select count(*) from public.saved s where s.kind='item' and s.target_id=i.id);
update public.notifications n set target_type='item',target_id=i.id::text
from public.items i where n.target_type='post' and n.target_id=i.post_id::text;
alter table public.drafts add column title text, add column description text;
update public.drafts set title=haul_title,description=caption;
alter table public.drafts alter column category set default 'shirts';

alter table public.posts set schema private;
alter table private.posts rename to posts_before_item_unification;
revoke all on private.posts_before_item_unification from public,anon,authenticated,service_role;

create index items_created_at_idx on public.items(created_at desc,id);
create index items_created_by_idx on public.items(created_by_id);
create index items_feed_likes_idx on public.items(like_count desc,created_at desc);
create index reports_item_id_idx on public.reports(item_id);
create index warnings_item_id_idx on public.warnings(item_id);

-- Compatibility for old shared URLs, SDK calls and already-open clients.
create view public.posts with (security_invoker=true) as select
  coalesce(post_id,id) as id,created_by_id,seller_name as creator_name,seller_avatar as creator_avatar,
  image_urls,description as caption,title as haul_title,tags,category,like_count,comment_count,
  view_count,share_count,bookmark_count,boost_expires_at,array[id] as item_ids,created_at,updated_at
from public.items;
create view public.post_likes with (security_invoker=true) as select coalesce(i.post_id,i.id) as post_id,l.user_id,l.created_at
from public.item_likes l join public.items i on i.id=l.item_id;
create view public.post_shares with (security_invoker=true) as select coalesce(i.post_id,i.id) as post_id,s.user_id,s.created_at
from public.item_shares s join public.items i on i.id=s.item_id;
grant select on public.posts to anon,authenticated,service_role;
grant insert,update,delete on public.posts to authenticated,service_role;
grant select on public.post_likes,public.post_shares to authenticated,service_role;
revoke all on public.item_likes,public.item_shares from anon,authenticated;
grant select on public.item_likes,public.item_shares to authenticated;
grant all on public.item_likes,public.item_shares to service_role;

create or replace function public.resolve_item_id(p_id uuid) returns uuid
language sql stable security invoker set search_path='' as $$
  select id from public.items where id=p_id or post_id=p_id order by (id=p_id) desc limit 1
$$;
revoke all on function public.resolve_item_id(uuid) from public;
grant execute on function public.resolve_item_id(uuid) to anon,authenticated,service_role;

-- One transaction and one row lock serialize likes and shares on each item.
create or replace function private.item_interaction(p_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid:=auth.uid(); v_liked boolean; v_count integer; v_recorded boolean:=false;
begin
  if v_user is null and p_action<>'view' then raise exception 'Authentication required' using errcode='42501'; end if;
  select id into v_id from public.items where id=p_id or post_id=p_id order by (id=p_id) desc limit 1 for update;
  if v_id is null then raise exception 'Item not found'; end if;
  if v_user is not null and exists(select 1 from public.blocks b join public.items i on i.id=v_id
    where (b.blocker_id=v_user and b.blocked_id=i.created_by_id) or (b.blocked_id=v_user and b.blocker_id=i.created_by_id)) then
    raise exception 'Item unavailable' using errcode='42501';
  end if;
  if p_action='like' then
    delete from public.item_likes where item_id=v_id and user_id=v_user;
    v_liked:=not found;
    if v_liked then insert into public.item_likes(item_id,user_id) values(v_id,v_user); end if;
    select count(*) into v_count from public.item_likes where item_id=v_id;
    update public.items set like_count=v_count where id=v_id;
    return jsonb_build_object('id',v_id,'item_id',v_id,'liked',v_liked,'like_count',v_count);
  elsif p_action='share' then
    insert into public.item_shares(item_id,user_id) values(v_id,v_user) on conflict do nothing returning true into v_recorded;
    if v_recorded then update public.items set share_count=share_count+1 where id=v_id; end if;
    select share_count into v_count from public.items where id=v_id;
    return jsonb_build_object('id',v_id,'share_count',v_count,'counted',coalesce(v_recorded,false));
  elsif p_action='view' then
    update public.items set view_count=view_count+1 where id=v_id returning view_count into v_count;
    return jsonb_build_object('id',v_id,'view_count',v_count);
  elsif p_action='bookmark' then
    select count(*) into v_count from public.saved where kind='item' and target_id=v_id;
    update public.items set bookmark_count=v_count where id=v_id;
    return jsonb_build_object('id',v_id,'bookmark_count',v_count);
  end if;
  raise exception 'Invalid interaction';
end $$;
revoke all on function private.item_interaction(uuid,text) from public;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.item_interaction(uuid,text) to anon,authenticated,service_role;
create or replace function public.toggle_item_like(p_item_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.item_interaction(p_item_id,'like') $$;
create or replace function public.record_item_share(p_item_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.item_interaction(p_item_id,'share') $$;
create or replace function public.record_item_view(p_item_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.item_interaction(p_item_id,'view') $$;
revoke all on function public.toggle_item_like(uuid),public.record_item_share(uuid),public.record_item_view(uuid) from public;
grant execute on function public.toggle_item_like(uuid),public.record_item_share(uuid) to authenticated,service_role;
grant execute on function public.record_item_view(uuid) to anon,authenticated,service_role;

create or replace function public.toggle_post_like(p_post_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.item_interaction(p_post_id,'like') $$;
create or replace function public.record_post_share(p_post_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.item_interaction(p_post_id,'share') $$;
create or replace function public.increment_post_counter(p_post_id uuid,p_counter text,p_delta integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
  if p_counter='view_count' and p_delta=1 then return private.item_interaction(p_post_id,'view'); end if;
  if p_counter='bookmark_count' and p_delta in (-1,1) then return private.item_interaction(p_post_id,'bookmark'); end if;
  raise exception 'Invalid counter update';
end $$;
revoke all on function public.toggle_post_like(uuid),public.record_post_share(uuid),public.increment_post_counter(uuid,text,integer) from public;
grant execute on function public.toggle_post_like(uuid),public.record_post_share(uuid) to authenticated,service_role;
grant execute on function public.increment_post_counter(uuid,text,integer) to anon,authenticated,service_role;

-- Keep cover images consistent and prevent clients from assigning paid boosts
-- or fabricating counters. Trusted server functions run as the database owner.
create or replace function private.prepare_item() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then
      new.like_count:=0; new.comment_count:=0; new.view_count:=0; new.share_count:=0; new.bookmark_count:=0;
      new.boost_expires_at:=null; new.boost_payment_ids:='{}';
    elsif (new.like_count,new.comment_count,new.view_count,new.share_count,new.bookmark_count,new.boost_expires_at,new.boost_payment_ids,new.created_by_id,new.post_id)
      is distinct from (old.like_count,old.comment_count,old.view_count,old.share_count,old.bookmark_count,old.boost_expires_at,old.boost_payment_ids,old.created_by_id,old.post_id) then
      raise exception 'Protected item fields cannot be changed by clients' using errcode='42501';
    end if;
  end if;
  if cardinality(new.image_urls)>0 then new.image_url:=new.image_urls[1];
  elsif nullif(new.image_url,'') is not null then new.image_urls:=array[new.image_url]; end if;
  new.updated_at:=now();
  return new;
end $$;
create trigger prepare_item before insert or update on public.items for each row execute function private.prepare_item();

create or replace function private.normalize_item_bookmark() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if new.kind='post' then
    new.target_id:=public.resolve_item_id(new.target_id);
    new.kind:='item';
  end if;
  if new.kind<>'item' or new.target_id is null or not exists(select 1 from public.items where id=new.target_id) then raise exception 'Item not found'; end if;
  if new.user_id is distinct from auth.uid() and current_user in ('anon','authenticated') then raise exception 'Invalid bookmark owner'; end if;
  return new;
end $$;
create trigger normalize_item_bookmark before insert or update on public.saved for each row execute function private.normalize_item_bookmark();
create or replace function private.count_item_bookmarks() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=case when tg_op='DELETE' then old.target_id else new.target_id end;
  perform 1 from public.items where id=v_id for update;
  update public.items set bookmark_count=(select count(*) from public.saved where kind='item' and target_id=v_id) where id=v_id;
  if tg_op='UPDATE' and old.target_id<>new.target_id then
    update public.items set bookmark_count=(select count(*) from public.saved where kind='item' and target_id=old.target_id) where id=old.target_id;
  end if;
  return null;
end $$;
revoke all on function private.count_item_bookmarks() from public,anon,authenticated;
create trigger count_item_bookmarks after insert or update or delete on public.saved for each row execute function private.count_item_bookmarks();

create or replace function private.guard_item_deletion() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if old.status in ('sold','reserved') or exists(select 1 from public.orders where item_id=old.id) then
    raise exception 'An item with an order or a reservation cannot be deleted';
  end if;
  return old;
end $$;
revoke all on function private.guard_item_deletion() from public,anon,authenticated;
create trigger guard_item_deletion before delete on public.items for each row execute function private.guard_item_deletion();
create or replace function private.cleanup_item() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  delete from public.saved where kind='item' and target_id=old.id;
  delete from public.notifications where target_type='item' and target_id=old.id::text;
  return null;
end $$;
revoke all on function private.cleanup_item() from public,anon,authenticated;
create trigger cleanup_item after delete on public.items for each row execute function private.cleanup_item();
create or replace function private.delete_item(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_item public.items; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_item from public.items where id=p_id or post_id=p_id order by (id=p_id) desc limit 1 for update;
  if v_item.id is null then raise exception 'Item not found'; end if;
  if v_item.created_by_id<>v_user and not public.is_admin() then raise exception 'Not your item' using errcode='42501'; end if;
  delete from public.items where id=v_item.id;
  return jsonb_build_object('ok',true,'item_id',v_item.id,'removed_items',1);
end $$;
revoke all on function private.delete_item(uuid) from public;
grant execute on function private.delete_item(uuid) to authenticated,service_role;
create or replace function public.delete_item(p_item_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.delete_item(p_item_id) $$;
revoke all on function public.delete_item(uuid) from public;
grant execute on function public.delete_item(uuid) to authenticated,service_role;

-- Apply a paid boost once per Stripe session, including repeated return visits.
create or replace function public.apply_item_boost(p_item_id uuid,p_session_id text,p_hours integer) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare v_expiry timestamptz;
begin
  if p_hours not in (24,72,168) or nullif(p_session_id,'') is null then raise exception 'Invalid boost'; end if;
  perform 1 from public.items where id=p_item_id for update;
  update public.items set boost_expires_at=greatest(coalesce(boost_expires_at,now()),now())+make_interval(hours=>p_hours),
    boost_payment_ids=array_append(boost_payment_ids,p_session_id)
  where id=p_item_id and not (p_session_id=any(boost_payment_ids));
  select boost_expires_at into v_expiry from public.items where id=p_item_id;
  return v_expiry;
end $$;
revoke all on function public.apply_item_boost(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.apply_item_boost(uuid,text,integer) to service_role;

-- The legacy client can still finish its former two-step publication during
-- rollout. It starts a temporary item via the view, then replaces it with the
-- actual listing, retaining the same legacy URL alias and all uploaded media.
create or replace function private.write_legacy_item() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if tg_op='INSERT' then
    new.id:=coalesce(new.id,gen_random_uuid());
    insert into public.items(id,post_id,created_by_id,seller_name,seller_avatar,title,description,image_urls,tags,category,price,shipping_price)
    values(new.id,new.id,coalesce(new.created_by_id,auth.uid()),new.creator_name,new.creator_avatar,new.haul_title,coalesce(new.caption,''),coalesce(new.image_urls,'{}'),coalesce(new.tags,'{}'),
      case when new.category in ('coats','trousers','shirts','accessories','shoes','dresses','tops','bottoms','outerwear') then new.category else 'other' end,0,0);
    return new;
  end if;
  select id into v_id from public.items where coalesce(post_id,id)=old.id;
  if tg_op='DELETE' then delete from public.items where id=v_id; return old; end if;
  update public.items set title=new.haul_title,description=coalesce(new.caption,''),
    image_urls=coalesce(new.image_urls,'{}'),tags=coalesce(new.tags,'{}'),seller_name=new.creator_name,seller_avatar=new.creator_avatar
  where id=v_id;
  return new;
end $$;
create trigger write_legacy_item instead of insert or update or delete on public.posts
for each row execute function private.write_legacy_item();
create or replace function private.finish_legacy_item() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_pending public.items;
begin
  if new.post_id is null or new.id=new.post_id then return new; end if;
  select * into v_pending from public.items where id=new.post_id and post_id=new.post_id and price=0
    and created_by_id=new.created_by_id for update;
  if v_pending.id is not null then
    if cardinality(new.image_urls)=0 then new.image_urls:=v_pending.image_urls; end if;
    delete from public.items where id=v_pending.id;
  end if;
  return new;
end $$;
create trigger finish_legacy_item before insert on public.items for each row execute function private.finish_legacy_item();
create or replace function private.prepare_item_draft() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if tg_op='INSERT' then
    new.title:=coalesce(new.title,new.haul_title); new.description:=coalesce(new.description,new.caption);
  else
    if new.title is not distinct from old.title and new.haul_title is distinct from old.haul_title then new.title:=new.haul_title; end if;
    if new.description is not distinct from old.description and new.caption is distinct from old.caption then new.description:=new.caption; end if;
  end if;
  new.haul_title:=new.title; new.caption:=new.description; return new;
end $$;
create trigger prepare_item_draft before insert or update on public.drafts for each row execute function private.prepare_item_draft();
notify pgrst,'reload schema';
commit;
