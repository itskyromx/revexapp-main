begin;
do $$
declare owner_id uuid; item_id uuid:=extensions.gen_random_uuid();
  old_url text:='https://rvznoiuhwkapwooyifvs.supabase.co/storage/v1/object/public/media/items/cleanup-test-old.jpg';
  new_url text:='https://rvznoiuhwkapwooyifvs.supabase.co/storage/v1/object/public/media/items/cleanup-test-new.jpg';
  snapshot jsonb; result jsonb;
begin
  select id into owner_id from public.profiles limit 1;
  if owner_id is null then raise exception 'A fixture owner is required'; end if;
  if has_function_privilege('anon','public.media_cleanup_snapshot()','EXECUTE') or
     has_function_privilege('authenticated','public.media_cleanup_snapshot()','EXECUTE') or
     has_function_privilege('authenticated','public.replace_duplicate_media(text,text)','EXECUTE') or
     has_function_privilege('authenticated','public.authorize_media_cleanup(text)','EXECUTE') then
    raise exception 'Cleanup RPCs must be service-only';
  end if;
  insert into public.items(id,created_by_id,title,price,image_url,image_urls,is_archived)
    values(item_id,owner_id,'Cleanup test',10,old_url,array[old_url],true);
  insert into public.drafts(created_by_id,media,items) values(owner_id,
    jsonb_build_array(jsonb_build_object('url',old_url,'type','image')),
    jsonb_build_array(jsonb_build_object('title','Duplicate','image_url',old_url)));
  perform public.replace_duplicate_media(old_url,new_url);
  if not exists(select 1 from public.items where id=item_id and image_url=new_url and image_urls=array[new_url]) then
    raise exception 'Item replacement failed';
  end if;
  if exists(select 1 from public.drafts where media::text like '%'||old_url||'%') then
    raise exception 'Draft replacement failed';
  end if;
  snapshot:=public.media_cleanup_snapshot();
  if not (snapshot->'references' ? new_url) then raise exception 'Live references missing'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  set local role authenticated;
  result:=public.delete_item(item_id);
  reset role;
  if result->>'ok'<>'true' then raise exception 'Item deletion failed'; end if;
  if not exists(select 1 from private.media_cleanup_queue where url=new_url) then raise exception 'Deletion did not enqueue media'; end if;
  if not (public.media_cleanup_snapshot()->'references' ? new_url) then raise exception 'Shared draft reference lost'; end if;
end $$;
rollback;
select 'PASS: service-only cleanup RPCs, nested/array replacements, archived references, deletion queue, shared draft preservation, rollback' result;
