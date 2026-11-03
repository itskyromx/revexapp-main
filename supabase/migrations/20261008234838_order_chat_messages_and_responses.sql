create or replace function private.lock_and_reject_blocked_message()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  latest_message_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      case
        when new.sender_id < new.receiver_id
          then new.sender_id::text || ':' || new.receiver_id::text
        else new.receiver_id::text || ':' || new.sender_id::text
      end,
      0
    )
  );

  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = new.receiver_id)
       or (b.blocker_id = new.receiver_id and b.blocked_id = new.sender_id)
  ) then
    raise exception using
      errcode = '42501',
      message = 'Cannot send a message while either user has blocked the other.';
  end if;

  select message.created_at
    into latest_message_at
  from public.chat_messages message
  where (message.sender_id = new.sender_id and message.receiver_id = new.receiver_id)
     or (message.sender_id = new.receiver_id and message.receiver_id = new.sender_id)
  order by message.created_at desc
  limit 1;

  new.created_at := greatest(
    pg_catalog.clock_timestamp(),
    coalesce(latest_message_at + interval '1 microsecond', '-infinity'::timestamptz)
  );
  return new;
end;
$function$;

drop policy if exists "sender deletes unanswered message" on public.chat_messages;
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
        and reply.created_at >= chat_messages.created_at
    )
  );
