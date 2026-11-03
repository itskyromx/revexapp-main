create or replace function public.increment_post_counter(p_post_id uuid, p_counter text, p_delta integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_counter not in ('bookmark_count', 'view_count') or p_delta not in (-1, 1) then raise exception 'Invalid counter update'; end if;
  if auth.uid() is null and p_counter <> 'view_count' then raise exception 'Authentication required'; end if;
  if p_counter = 'view_count' and p_delta <> 1 then raise exception 'Invalid counter update'; end if;
  if p_counter = 'bookmark_count' then
    update public.posts set bookmark_count = greatest(0, coalesce(bookmark_count, 0) + p_delta) where id = p_post_id returning bookmark_count into v_count;
  else
    update public.posts set view_count = greatest(0, coalesce(view_count, 0) + 1) where id = p_post_id returning view_count into v_count;
  end if;
  if not found then raise exception 'Post not found'; end if;
  return jsonb_build_object('id', p_post_id, p_counter, v_count);
end;
$$;
revoke all on function public.increment_post_counter(uuid, text, integer) from public;
grant execute on function public.increment_post_counter(uuid, text, integer) to anon, authenticated;
