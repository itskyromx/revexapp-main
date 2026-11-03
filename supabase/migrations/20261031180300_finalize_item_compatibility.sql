begin;
create policy service_role_item_boost_payments on private.item_boost_payments
  for all to service_role using (true) with check (true);
-- Snapshots must neither prevent account deletion nor retain deleted items.
alter table private.posts_before_item_unification drop constraint posts_created_by_id_fkey;
alter table private.posts_before_item_unification add constraint legacy_posts_owner_fkey
  foreign key(created_by_id) references auth.users(id) on delete set null;
create or replace function private.cleanup_item() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  delete from public.saved where kind='item' and target_id=old.id;
  delete from public.notifications where target_type='item' and target_id=old.id::text;
  delete from private.posts_before_item_unification where id=old.post_id;
  return null;
end $$;
-- Normalize notifications from an application tab opened before deployment.
create or replace function private.normalize_item_notification() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if new.target_type='post' and new.target_id ~ '^[0-9a-fA-F-]{36}$' then
    v_id:=public.resolve_item_id(new.target_id::uuid);
    if v_id is not null then new.target_type:='item'; new.target_id:=v_id::text; end if;
  end if;
  return new;
end $$;
create trigger normalize_item_notification before insert or update on public.notifications
for each row execute function private.normalize_item_notification();
notify pgrst,'reload schema';
commit;
