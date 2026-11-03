begin;
-- Supabase's default ACL also grants EXECUTE directly to anon. Revoke those
-- inherited grants as well as PUBLIC, then expose only the intended roles.
revoke all on function public.toggle_item_like(uuid),public.record_item_share(uuid),public.delete_item(uuid),
  public.toggle_post_like(uuid),public.record_post_share(uuid) from public,anon,authenticated;
grant execute on function public.toggle_item_like(uuid),public.record_item_share(uuid),public.delete_item(uuid),
  public.toggle_post_like(uuid),public.record_post_share(uuid) to authenticated,service_role;

-- Stripe payment identifiers belong in a private ledger, not in public items.
create table private.item_boost_payments (
  session_id text primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  applied_at timestamptz not null default now()
);
alter table private.item_boost_payments enable row level security;
create index item_boost_payments_item_id_idx on private.item_boost_payments(item_id);
revoke all on private.item_boost_payments from public,anon,authenticated;
grant select,insert on private.item_boost_payments to service_role;
insert into private.item_boost_payments(session_id,item_id)
select unnest(boost_payment_ids),id from public.items on conflict do nothing;
create or replace function public.apply_item_boost(p_item_id uuid,p_session_id text,p_hours integer) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare v_expiry timestamptz; v_added boolean;
begin
  if p_hours not in (24,72,168) or nullif(p_session_id,'') is null then raise exception 'Invalid boost'; end if;
  perform 1 from public.items where id=p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  insert into private.item_boost_payments(session_id,item_id) values(p_session_id,p_item_id)
    on conflict do nothing returning true into v_added;
  if v_added then
    update public.items set boost_expires_at=greatest(coalesce(boost_expires_at,now()),now())+make_interval(hours=>p_hours)
    where id=p_item_id;
  elsif not exists(select 1 from private.item_boost_payments where session_id=p_session_id and item_id=p_item_id) then
    raise exception 'Payment belongs to a different item';
  end if;
  select boost_expires_at into v_expiry from public.items where id=p_item_id;
  return v_expiry;
end $$;
create or replace function private.prepare_item() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then
      new.like_count:=0; new.comment_count:=0; new.view_count:=0; new.share_count:=0; new.bookmark_count:=0;
      new.boost_expires_at:=null;
    elsif (new.like_count,new.comment_count,new.view_count,new.share_count,new.bookmark_count,new.boost_expires_at,new.created_by_id,new.post_id)
      is distinct from (old.like_count,old.comment_count,old.view_count,old.share_count,old.bookmark_count,old.boost_expires_at,old.created_by_id,old.post_id) then
      raise exception 'Protected item fields cannot be changed by clients' using errcode='42501';
    end if;
  end if;
  if cardinality(new.image_urls)>0 then new.image_url:=new.image_urls[1];
  elsif nullif(new.image_url,'') is not null then new.image_urls:=array[new.image_url]; end if;
  new.updated_at:=now(); return new;
end $$;
alter table public.items drop column boost_payment_ids;
notify pgrst,'reload schema';
commit;
