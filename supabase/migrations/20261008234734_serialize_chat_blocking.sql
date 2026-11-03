create or replace function private.lock_new_block_pair()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      case
        when new.blocker_id < new.blocked_id
          then new.blocker_id::text || ':' || new.blocked_id::text
        else new.blocked_id::text || ':' || new.blocker_id::text
      end,
      0
    )
  );
  return new;
end;
$function$;

create or replace function private.lock_and_reject_blocked_message()
returns trigger
language plpgsql
set search_path = ''
as $function$
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

  return new;
end;
$function$;

revoke all on function private.lock_new_block_pair() from public, anon, authenticated;
revoke all on function private.lock_and_reject_blocked_message() from public, anon, authenticated;

drop trigger if exists lock_new_block_pair on public.blocks;
create trigger lock_new_block_pair
  before insert on public.blocks
  for each row execute function private.lock_new_block_pair();

drop trigger if exists lock_and_reject_blocked_message on public.chat_messages;
create trigger lock_and_reject_blocked_message
  before insert on public.chat_messages
  for each row execute function private.lock_and_reject_blocked_message();
