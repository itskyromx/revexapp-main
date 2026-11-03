begin;
set local lock_timeout='5s';
lock table public.item_likes,public.notifications in share row exclusive mode;

-- Unlike/removing an alert must not reset the notification eligibility.
create table private.item_like_notification_history (
  actor_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  first_notified_at timestamptz not null default now(),
  primary key(actor_id,item_id,recipient_id)
);
alter table private.item_like_notification_history enable row level security;
create index item_like_notification_history_item_idx on private.item_like_notification_history(item_id);
create index item_like_notification_history_recipient_idx on private.item_like_notification_history(recipient_id);
revoke all on private.item_like_notification_history from public,anon,authenticated,service_role;
grant select on private.item_like_notification_history to service_role;
create policy service_reads_like_notification_history on private.item_like_notification_history
  for select to service_role using(true);

-- Keep the earliest alert and remember existing deliveries before enabling
-- the constraint, including legacy links that still resolve to a live item.
insert into private.item_like_notification_history(actor_id,item_id,recipient_id,first_notified_at)
select n.actor_id,i.id,n.recipient_id,min(n.created_at)
from public.notifications n join public.items i
  on n.target_id=i.id::text or n.target_id=i.post_id::text
where n.type='like' and n.target_type in ('item','post') and n.actor_id is not null
group by n.actor_id,i.id,n.recipient_id
on conflict do nothing;
with ranked as (
  select n.id,row_number() over(partition by n.actor_id,i.id,n.recipient_id order by n.created_at,n.id) as position
  from public.notifications n join public.items i
    on n.target_id=i.id::text or n.target_id=i.post_id::text
  where n.type='like' and n.target_type in ('item','post') and n.actor_id is not null
)
delete from public.notifications n using ranked r where n.id=r.id and r.position>1;

create or replace function private.deduplicate_item_like_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_item public.items; v_inserted boolean;
begin
  if new.type<>'like' or new.target_type<>'item' then return new; end if;
  if new.actor_id is null or new.actor_id=new.recipient_id then return null; end if;
  if new.target_id is null or new.target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  select * into v_item from public.items where id=new.target_id::uuid;
  if v_item.id is null or v_item.created_by_id is distinct from new.recipient_id then return null; end if;
  if not exists(select 1 from public.item_likes where item_id=v_item.id and user_id=new.actor_id) then return null; end if;
  if exists(select 1 from public.blocks where (blocker_id=new.actor_id and blocked_id=new.recipient_id)
    or (blocker_id=new.recipient_id and blocked_id=new.actor_id)) then return null; end if;
  insert into private.item_like_notification_history(actor_id,item_id,recipient_id)
  values(new.actor_id,v_item.id,new.recipient_id) on conflict do nothing returning true into v_inserted;
  if not coalesce(v_inserted,false) then return null; end if;
  return new;
end $$;
revoke all on function private.deduplicate_item_like_notification() from public,anon,authenticated,service_role;
-- Alphabetical order runs legacy target normalization before deduplication.
create trigger z_deduplicate_item_like_notification before insert on public.notifications
for each row execute function private.deduplicate_item_like_notification();

create or replace function private.notify_item_like_once() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_item public.items; v_actor public.profiles; v_name text;
begin
  select * into v_item from public.items where id=new.item_id;
  if v_item.created_by_id is null or v_item.created_by_id=new.user_id then return null; end if;
  select * into v_actor from public.profiles where id=new.user_id;
  v_name:=coalesce(nullif(v_actor.display_name,''),nullif(v_actor.full_name,''),'Someone');
  insert into public.notifications(created_by_id,recipient_id,actor_id,actor_name,actor_avatar,thumbnail,type,title,body,target_type,target_id)
  values(new.user_id,v_item.created_by_id,new.user_id,v_name,coalesce(v_actor.avatar,''),coalesce(v_item.image_url,''),
    'like',v_name,'liked your item "'||v_item.title||'"','item',v_item.id::text);
  return null;
end $$;
revoke all on function private.notify_item_like_once() from public,anon,authenticated,service_role;
create trigger notify_item_like_once after insert on public.item_likes
for each row execute function private.notify_item_like_once();
commit;
