begin;
set local lock_timeout='5s';

create table private.media_moderation_settings (
  singleton boolean primary key default true check(singleton),
  enforced boolean not null default false
);
insert into private.media_moderation_settings(singleton) values(true);
create table private.media_moderation_checks (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  policy_version text not null,
  status text not null default 'checking' check(status in ('checking','approved','rejected','error')),
  reason text,
  created_at timestamptz not null default now()
);
create index media_moderation_checks_owner_time on private.media_moderation_checks(owner_id,created_at desc);
create index media_moderation_checks_hash on private.media_moderation_checks(owner_id,sha256,policy_version,created_at desc);
create table private.approved_media (
  path text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  check_id uuid references private.media_moderation_checks(id) on delete set null,
  source text not null check(source in ('legacy','moderated')),
  created_at timestamptz not null default now()
);
-- Existing media stays usable. This rollout moderates NEW uploads only.
insert into private.approved_media(path,owner_id,source)
select name,case when exists(select 1 from auth.users u where u.id=o.owner) then owner else null end,'legacy'
from storage.objects o where bucket_id='media';

alter table private.media_moderation_settings enable row level security;
alter table private.media_moderation_checks enable row level security;
alter table private.approved_media enable row level security;
revoke all on private.media_moderation_settings,private.media_moderation_checks,private.approved_media from public,anon,authenticated;
create policy media_settings_service on private.media_moderation_settings to service_role using(true) with check(true);
create policy media_checks_service on private.media_moderation_checks to service_role using(true) with check(true);
create policy approved_media_service on private.approved_media to service_role using(true) with check(true);

create function private.media_moderation_enforced() returns boolean
language sql stable security definer set search_path='' as $$
  select enforced from private.media_moderation_settings where singleton
$$;
revoke all on function private.media_moderation_enforced() from public;
grant execute on function private.media_moderation_enforced() to anon,authenticated,service_role;
create policy moderated_media_insert_only on storage.objects as restrictive for insert to anon,authenticated
  with check(bucket_id<>'media' or not (select private.media_moderation_enforced()));
create policy moderated_media_update_only on storage.objects as restrictive for update to anon,authenticated
  using(bucket_id<>'media' or not (select private.media_moderation_enforced()))
  with check(bucket_id<>'media' or not (select private.media_moderation_enforced()));

create function public.reserve_media_moderation(p_owner uuid,p_hash text,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare recent private.media_moderation_checks; new_id uuid; cached_path text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,137));
  select * into recent from private.media_moderation_checks
    where owner_id=p_owner and sha256=p_hash and policy_version=p_policy
    order by created_at desc limit 1;
  if recent.status='approved' then
    select a.path into cached_path from private.approved_media a join storage.objects o on o.name=a.path and o.bucket_id='media'
      where a.check_id=recent.id limit 1;
    if cached_path is not null then return jsonb_build_object('cached_path',cached_path); end if;
  elsif recent.status='rejected' then
    return jsonb_build_object('rejected',true,'reason',recent.reason);
  elsif recent.status='checking' and recent.created_at>now()-interval '2 minutes' then
    return jsonb_build_object('busy',true);
  end if;
  if (select count(*) from private.media_moderation_checks where owner_id=p_owner and created_at>now()-interval '10 minutes')>=20
    or (select count(*) from private.media_moderation_checks where owner_id=p_owner and created_at>now()-interval '1 day')>=200 then
    return jsonb_build_object('rate_limited',true);
  end if;
  insert into private.media_moderation_checks(owner_id,sha256,policy_version) values(p_owner,p_hash,p_policy) returning id into new_id;
  return jsonb_build_object('id',new_id);
end $$;
revoke all on function public.reserve_media_moderation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_media_moderation(uuid,text,text) to service_role;

create function public.finish_media_moderation(p_id uuid,p_status text,p_reason text default null,p_path text default null) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  if p_status not in ('approved','rejected','error') then raise exception 'Invalid decision'; end if;
  update private.media_moderation_checks set status=p_status,reason=p_reason
    where id=p_id and status='checking' returning media_moderation_checks.owner_id into owner_id;
  if owner_id is null then raise exception 'Check not pending'; end if;
  if p_status='approved' then
    if p_path is null or p_path not like '%/'||owner_id::text||'/%' then raise exception 'Invalid path'; end if;
    insert into private.approved_media(path,owner_id,check_id,source) values(p_path,owner_id,p_id,'moderated');
  end if;
end $$;
revoke all on function public.finish_media_moderation(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_media_moderation(uuid,text,text,text) to service_role;

create function private.decode_media_path(p_value text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare result bytea:=''::bytea; i integer:=1; part text;
begin
  while i<=length(p_value) loop
    part:=substr(p_value,i,3);
    if part ~ '^%[0-9A-Fa-f]{2}$' then
      result:=result||decode(substr(part,2,2),'hex'); i:=i+3;
    else
      result:=result||convert_to(substr(p_value,i,1),'UTF8'); i:=i+1;
    end if;
  end loop;
  return convert_from(result,'UTF8');
end $$;
revoke all on function private.decode_media_path(text) from public,anon,authenticated;

create function private.require_approved_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare fields text[]; key text; value jsonb; old_value jsonb; image text; prefix text; path text;
begin
  if auth.role() is distinct from 'authenticated' or not private.media_moderation_enforced() then return new; end if;
  fields:=case tg_table_name when 'items' then array['image_url','image_urls','try_on_video_url','seller_avatar']
    when 'profiles' then array['avatar'] else array['media'] end;
  select split_part(endpoint,'/functions/',1)||'/storage/v1/object/public/media/' into prefix from private.media_cleanup_config where singleton;
  foreach key in array fields loop
    value:=to_jsonb(new)->key;
    old_value:=case when tg_op='UPDATE' then to_jsonb(old)->key else null end;
    if value is not distinct from old_value then continue; end if;
    for image in select v #>> '{}' from jsonb_path_query(coalesce(value,'null'), 'strict $.** ? (@.type() == "string")') v loop
      if image='' then continue; end if;
      if tg_table_name='items' and key='seller_avatar' and exists(select 1 from public.profiles where id=(to_jsonb(new)->>'created_by_id')::uuid and avatar=image) then continue; end if;
      -- Draft product descriptions are not media; check only URL-valued strings.
      if tg_table_name='drafts' and image !~* '^(https?:|data:|blob:|//)' then continue; end if;
      -- An unchanged legacy URL may coexist with newly approved photos.
      if tg_op='UPDATE' and exists(select 1 from jsonb_path_query(coalesce(old_value,'null'),'strict $.** ? (@.type() == "string")') v where v #>> '{}' = image) then continue; end if;
      if prefix is null or left(image,length(prefix))<>prefix then raise exception 'Upload images through Revex for a safety check' using errcode='42501'; end if;
      path:=private.decode_media_path(split_part(split_part(substr(image,length(prefix)+1),'?',1),'#',1));
      if not exists(select 1 from private.approved_media where approved_media.path=path) then
        raise exception 'Image has not passed the safety check' using errcode='42501';
      end if;
    end loop;
  end loop;
  return new;
end $$;
revoke all on function private.require_approved_media() from public,anon,authenticated;
create trigger require_item_media_approval before insert or update on public.items for each row execute function private.require_approved_media();
create trigger require_draft_media_approval before insert or update on public.drafts for each row execute function private.require_approved_media();
create trigger require_avatar_approval before insert or update on public.profiles for each row execute function private.require_approved_media();

create function private.activate_media_moderation() returns void
language sql security definer set search_path='' as $$
  update private.media_moderation_settings set enforced=true where singleton
$$;
revoke all on function private.activate_media_moderation() from public,anon,authenticated;

create function private.prune_media_moderation() returns void
language plpgsql security definer set search_path='' as $$
begin
  update private.media_moderation_checks set status='error',reason='expired' where status='checking' and created_at<now()-interval '1 day';
  delete from private.media_moderation_checks where created_at<now()-interval '30 days';
  delete from private.approved_media a where created_at<now()-interval '7 days' and not exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=a.path);
end $$;
revoke all on function private.prune_media_moderation() from public,anon,authenticated;
select cron.schedule('prune-media-moderation','43 3 * * *','select private.prune_media_moderation();');
notify pgrst,'reload schema';
commit;
