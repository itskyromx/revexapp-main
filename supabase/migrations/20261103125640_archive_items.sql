begin;
set local lock_timeout='5s';
alter table public.items add column is_archived boolean not null default false;
comment on column public.items.is_archived is 'Hidden from everyone except the owner; does not change the sale/order status.';
create policy archived_items_owner_only on public.items as restrictive
  for select to anon,authenticated using(not is_archived or created_by_id=(select auth.uid()));
create index items_public_feed_idx on public.items(created_at desc,id)
  where not is_archived and status='available';

-- These RPCs run with elevated privileges, so explicitly enforce visibility.
create or replace function private.item_interaction(p_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid:=auth.uid(); v_liked boolean; v_count integer; v_recorded boolean:=false;
begin
  if v_user is null and p_action<>'view' then raise exception 'Authentication required' using errcode='42501'; end if;
  select id into v_id from public.items where id=p_id or post_id=p_id order by (id=p_id) desc limit 1 for update;
  if v_id is null then raise exception 'Item not found'; end if;
  if exists(select 1 from public.items where id=v_id and is_archived and created_by_id is distinct from v_user) then
    raise exception 'Item unavailable' using errcode='42501';
  end if;
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

-- Prevent stale tabs from placing new orders/offers for an archived listing.
-- Existing order updates and fulfilment remain available.
create or replace function private.require_listed_item() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_archived boolean;
begin
  if new.item_id is null then return new; end if;
  select is_archived into v_archived from public.items where id=new.item_id;
  if not found or v_archived then raise exception 'Item unavailable' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.require_listed_item() from public,anon,authenticated,service_role;
create trigger require_listed_order_item before insert on public.orders
  for each row execute function private.require_listed_item();
create trigger require_listed_offer_item before insert on public.offers
  for each row execute function private.require_listed_item();
notify pgrst,'reload schema';
commit;
