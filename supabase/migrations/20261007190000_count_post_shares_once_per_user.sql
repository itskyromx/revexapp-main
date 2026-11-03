create table if not exists public.post_shares (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_shares enable row level security;
drop policy if exists "Users can read own post shares" on public.post_shares;
create policy "Users can read own post shares" on public.post_shares
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.post_shares to authenticated;
revoke insert, update, delete on public.post_shares from anon, authenticated;

create or replace function public.record_post_share(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_recorded boolean := false;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  insert into public.post_shares(post_id, user_id)
  select p_post_id, v_user_id where exists (select 1 from public.posts where id = p_post_id)
  on conflict (post_id, user_id) do nothing returning true into v_recorded;
  if not exists (select 1 from public.posts where id = p_post_id) then raise exception 'Post not found'; end if;
  if v_recorded then
    update public.posts set share_count = coalesce(share_count, 0) + 1 where id = p_post_id returning share_count into v_count;
  else
    select share_count into v_count from public.posts where id = p_post_id;
  end if;
  return jsonb_build_object('id', p_post_id, 'share_count', v_count, 'counted', coalesce(v_recorded, false));
end;
$$;

revoke all on function public.record_post_share(uuid) from public, anon;
grant execute on function public.record_post_share(uuid) to authenticated;
