create index if not exists chat_messages_sender_receiver_created_at_idx
  on public.chat_messages (sender_id, receiver_id, created_at);

drop policy if exists "sender inserts message" on public.chat_messages;
create policy "sender inserts message"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and not exists (
      select 1
      from public.blocks b
      where b.blocker_id = chat_messages.sender_id
        and b.blocked_id = chat_messages.receiver_id
    )
    and not exists (
      select 1
      from public.blocks b
      where b.blocker_id = chat_messages.receiver_id
        and b.blocked_id = chat_messages.sender_id
    )
  );

drop policy if exists "sender deletes own message" on public.chat_messages;
create policy "sender deletes unanswered message"
  on public.chat_messages
  for delete
  to authenticated
  using (
    (select auth.uid()) = sender_id
    and not exists (
      select 1
      from public.chat_messages reply
      where reply.sender_id = chat_messages.receiver_id
        and reply.receiver_id = chat_messages.sender_id
        and reply.created_at > chat_messages.created_at
    )
  );

drop policy if exists "blocker creates block" on public.blocks;
create policy "blocker creates block"
  on public.blocks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by_id
    and (select auth.uid()) = blocker_id
    and blocker_id <> blocked_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_clears'
  ) then
    alter publication supabase_realtime add table public.chat_clears;
  end if;
end
$$;
