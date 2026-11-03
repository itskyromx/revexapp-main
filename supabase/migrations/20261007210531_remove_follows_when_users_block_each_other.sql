create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.remove_follows_when_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows f
  where (f.follower_id = new.blocker_id and f.followee_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.followee_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function private.remove_follows_when_blocked() from public, anon, authenticated;
drop trigger if exists remove_follows_when_blocked on public.blocks;
create trigger remove_follows_when_blocked
after insert on public.blocks
for each row execute function private.remove_follows_when_blocked();
delete from public.follows f using public.blocks b
where (f.follower_id = b.blocker_id and f.followee_id = b.blocked_id)
   or (f.follower_id = b.blocked_id and f.followee_id = b.blocker_id);
