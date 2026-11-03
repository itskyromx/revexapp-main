create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.chat_message_deletions (
  message_id uuid primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

alter table public.chat_message_deletions enable row level security;
revoke all on public.chat_message_deletions from public, anon, authenticated;
grant select on public.chat_message_deletions to authenticated;

drop policy if exists "participants read chat message deletions" on public.chat_message_deletions;
create policy "participants read chat message deletions"
  on public.chat_message_deletions for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function private.publish_chat_message_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_message_deletions (message_id, sender_id, receiver_id)
  values (old.id, old.sender_id, old.receiver_id)
  on conflict (message_id) do nothing;
  return old;
end;
$$;

revoke all on function private.publish_chat_message_deletion() from public, anon, authenticated;
drop trigger if exists publish_chat_message_deletion on public.chat_messages;
create trigger publish_chat_message_deletion
  after delete on public.chat_messages
  for each row execute function private.publish_chat_message_deletion();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_message_deletions'
  ) then
    alter publication supabase_realtime add table public.chat_message_deletions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows'
  ) then
    alter publication supabase_realtime add table public.follows;
  end if;
end $$;
