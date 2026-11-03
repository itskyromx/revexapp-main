create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;
drop policy if exists "Users can read own post likes" on public.post_likes;
create policy "Users can read own post likes" on public.post_likes
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.post_likes to authenticated;
revoke insert, update, delete on public.post_likes from anon, authenticated;

create or replace function public.toggle_post_like(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.posts where id = p_post_id) then raise exception 'Post not found'; end if;
  delete from public.post_likes where post_id = p_post_id and user_id = v_user_id;
  if found then
    v_liked := false;
    update public.posts set like_count = greatest(0, coalesce(like_count, 0) - 1) where id = p_post_id returning like_count into v_count;
  else
    insert into public.post_likes(post_id, user_id) values (p_post_id, v_user_id) on conflict do nothing;
    v_liked := true;
    update public.posts set like_count = coalesce(like_count, 0) + 1 where id = p_post_id returning like_count into v_count;
  end if;
  return jsonb_build_object('post_id', p_post_id, 'liked', v_liked, 'like_count', v_count);
end;
$$;

create or replace function public.increment_post_counter(p_post_id uuid, p_counter text, p_delta integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_counter not in ('bookmark_count', 'view_count', 'share_count') or p_delta not in (-1, 1) then raise exception 'Invalid counter update'; end if;
  if p_counter = 'bookmark_count' then
    update public.posts set bookmark_count = greatest(0, coalesce(bookmark_count, 0) + p_delta) where id = p_post_id returning bookmark_count into v_count;
  elsif p_counter = 'view_count' then
    update public.posts set view_count = greatest(0, coalesce(view_count, 0) + p_delta) where id = p_post_id returning view_count into v_count;
  else
    update public.posts set share_count = greatest(0, coalesce(share_count, 0) + p_delta) where id = p_post_id returning share_count into v_count;
  end if;
  if not found then raise exception 'Post not found'; end if;
  return jsonb_build_object('id', p_post_id, p_counter, v_count);
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public, anon;
grant execute on function public.toggle_post_like(uuid) to authenticated;
revoke all on function public.increment_post_counter(uuid, text, integer) from public, anon;
grant execute on function public.increment_post_counter(uuid, text, integer) to authenticated;
