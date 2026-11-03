create unique index if not exists profiles_display_name_username_unique_idx
  on public.profiles (lower(btrim(display_name)))
  where display_name is not null and btrim(display_name) <> '';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  chosen_username text;
begin
  chosen_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if chosen_username = '' then
    chosen_username := null;
  elsif chosen_username !~ '^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$' then
    raise exception using
      errcode = '23514',
      message = 'Username must be 3–20 characters, using letters, numbers, and underscores.';
  end if;

  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    chosen_username
  );
  return new;
end;
$function$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();
