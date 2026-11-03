begin;
set local lock_timeout = '5s';
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- A dedicated credential for this worker only; no account/API secrets are read.
create table private.media_cleanup_config (
  singleton boolean primary key default true check (singleton),
  endpoint text,
  token text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into private.media_cleanup_config(singleton) values(true);
create table private.media_cleanup_queue (
  url text primary key,
  created_at timestamptz not null default now()
);
alter table private.media_cleanup_config enable row level security;
alter table private.media_cleanup_queue enable row level security;
revoke all on private.media_cleanup_config, private.media_cleanup_queue from public, anon, authenticated;

create function private.media_urls(p_data jsonb) returns setof text
language sql immutable security invoker set search_path='' as $$
  select distinct v #>> '{}' from jsonb_path_query(p_data, 'strict $.** ? (@.type() == "string")') v
  where position('/storage/v1/object/' in (v #>> '{}')) > 0
$$;
revoke all on function private.media_urls(jsonb) from public, anon, authenticated;

create function public.authorize_media_cleanup(p_token text) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from private.media_cleanup_config where token = p_token and length(p_token)=64)
$$;
revoke all on function public.authorize_media_cleanup(text) from public, anon, authenticated;
grant execute on function public.authorize_media_cleanup(text) to service_role;

create function public.media_cleanup_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text; refs text[] := '{}'; part text[]; objects jsonb; pending jsonb;
begin
  -- Archived items, drafts, avatars and transaction/moderation snapshots count.
  foreach t in array array['items','drafts','profiles','orders','offers','notifications','reports','reviews','warnings','chat_messages','follows'] loop
    execute format('select array_agg(distinct u) from public.%I r cross join lateral private.media_urls(to_jsonb(r)) u', t) into part;
    refs := refs || coalesce(part, '{}'::text[]);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'created_at',created_at,'metadata',metadata)), '[]') into objects
    from storage.objects where bucket_id='media';
  select coalesce(jsonb_agg(url), '[]') into pending from private.media_cleanup_queue;
  return jsonb_build_object('objects',objects,'references',to_jsonb(refs),'pending',pending);
end $$;
revoke all on function public.media_cleanup_snapshot() from public, anon, authenticated;
grant execute on function public.media_cleanup_snapshot() to service_role;

create function public.acknowledge_media_cleanup(p_urls text[]) returns void
language sql security definer set search_path='' as $$
  delete from private.media_cleanup_queue where url=any(p_urls)
$$;
revoke all on function public.acknowledge_media_cleanup(text[]) from public, anon, authenticated;
grant execute on function public.acknowledge_media_cleanup(text[]) to service_role;

-- Replace complete JSON string values, never arbitrary substrings or identifiers.
create function private.replace_media_url(p_value jsonb, p_old text, p_new text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
  case jsonb_typeof(p_value)
    when 'string' then
      if p_value #>> '{}' = p_old then return to_jsonb(p_new); end if;
    when 'array' then
      select coalesce(jsonb_agg(private.replace_media_url(v,p_old,p_new) order by n),'[]') into result from jsonb_array_elements(p_value) with ordinality a(v,n);
      return result;
    when 'object' then
      select coalesce(jsonb_object_agg(k,private.replace_media_url(v,p_old,p_new)),'{}') into result from jsonb_each(p_value) a(k,v);
      return result;
    else null;
  end case;
  return p_value;
end $$;
revoke all on function private.replace_media_url(jsonb,text,text) from public, anon, authenticated;

create function public.replace_duplicate_media(p_old text, p_new text) returns void
language plpgsql security definer set search_path='' as $$
declare c record; expr text;
begin
  if p_old=p_new or p_old not like '%/storage/v1/object/public/media/%' or p_new not like '%/storage/v1/object/public/media/%' then
    raise exception 'Invalid media replacement';
  end if;
  -- Touch only columns containing URLs, including nested draft JSON and arrays.
  for c in select table_name,column_name,data_type from information_schema.columns
    where table_schema='public' and (
      (table_name='items' and column_name in ('image_url','image_urls','try_on_video_url','seller_avatar')) or
      (table_name='drafts' and column_name in ('media','items')) or
      (table_name='profiles' and column_name='avatar') or
      (table_name in ('orders','offers') and column_name='item_image') or
      (table_name='notifications' and column_name in ('thumbnail','actor_avatar')) or
      (table_name='reports' and column_name='item_thumbnail') or
      (table_name='reviews' and column_name='buyer_avatar') or
      (table_name='posts' and column_name in ('image_urls','creator_avatar'))
    ) and table_name <> 'posts' loop
      if c.data_type='ARRAY' then
        expr := format('array(select jsonb_array_elements_text(private.replace_media_url(to_jsonb(%I),$1,$2)))',c.column_name);
      elsif c.data_type='jsonb' then
        expr := format('private.replace_media_url(%I,$1,$2)',c.column_name);
      else
        expr := format('(private.replace_media_url(to_jsonb(%I),$1,$2) #>> ''{}'')',c.column_name);
      end if;
      execute format('update public.%I set %I=%s where position($1 in %I::text)>0',c.table_name,c.column_name,expr,c.column_name) using p_old,p_new;
  end loop;
end $$;
revoke all on function public.replace_duplicate_media(text,text) from public, anon, authenticated;
grant execute on function public.replace_duplicate_media(text,text) to service_role;

create function private.request_media_cleanup(p_maintenance boolean default false, p_apply boolean default true) returns bigint
language plpgsql security definer set search_path='' as $$
declare c private.media_cleanup_config;
begin
  select * into c from private.media_cleanup_config where singleton;
  if c.endpoint is null then return null; end if;
  return net.http_post(url:=c.endpoint,
    headers:=jsonb_build_object('Content-Type','application/json','x-media-cleanup-token',c.token),
    body:=jsonb_build_object('maintenance',p_maintenance,'apply',p_apply),timeout_milliseconds:=120000);
end $$;
revoke all on function private.request_media_cleanup(boolean,boolean) from public, anon, authenticated;

create function private.queue_removed_media() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.media_cleanup_queue(url) select private.media_urls(to_jsonb(old)) on conflict do nothing;
  -- pg_net sends this only after the delete transaction commits.
  begin
    perform private.request_media_cleanup();
  exception when others then
    raise warning 'Media cleanup deferred to scheduled retry';
  end;
  return old;
end $$;
revoke all on function private.queue_removed_media() from public, anon, authenticated;
create trigger cleanup_deleted_item_media after delete on public.items for each row execute function private.queue_removed_media();
create trigger cleanup_deleted_draft_media after delete on public.drafts for each row execute function private.queue_removed_media();
select cron.schedule('cleanup-unused-media','17 * * * *','select private.request_media_cleanup();');
notify pgrst,'reload schema';
commit;
