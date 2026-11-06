begin;
do $$
declare actor uuid; item_id uuid:=extensions.gen_random_uuid(); reservation jsonb; new_path text; base text;
begin
  select id into actor from public.profiles limit 1;
  if actor is null then raise exception 'A fixture user is required'; end if;
  select split_part(endpoint,'/functions/',1)||'/storage/v1/object/public/media/' into base from private.media_cleanup_config;
  if has_function_privilege('authenticated','public.reserve_media_moderation(uuid,text,text)','EXECUTE') or
     has_function_privilege('anon','public.finish_media_moderation(uuid,text,text,text)','EXECUTE') then
    raise exception 'Moderation decisions must not be client-writable';
  end if;
  reservation:=public.reserve_media_moderation(actor,repeat('a',64),'sql-test');
  if reservation->>'id' is null then raise exception 'Reservation failed'; end if;
  if public.reserve_media_moderation(actor,repeat('a',64),'sql-test')->>'busy'<>'true' then raise exception 'Concurrent check not prevented'; end if;
  new_path:='items/'||actor||'/'||extensions.gen_random_uuid()||'.png';
  perform public.finish_media_moderation((reservation->>'id')::uuid,'approved',null,new_path);
  perform private.activate_media_moderation();
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.items(id,created_by_id,title,price,image_url,image_urls)
    values(item_id,actor,'Moderation test',10,base||new_path,array[base||new_path]);
  begin
    update public.items set image_url=base||'items/unapproved.png',image_urls=array[base||'items/unapproved.png'] where id=item_id;
    raise exception 'Unapproved media was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.items set image_urls=array['https://external.example/unmoderated.jpg'] where id=item_id;
    raise exception 'External bypass was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set avatar='data:image/png;base64,AAAA' where id=actor;
    raise exception 'Avatar bypass was accepted';
  exception when insufficient_privilege then null; end;
  insert into public.drafts(created_by_id,media,items) values(actor,jsonb_build_array(jsonb_build_object('url',base||new_path,'type','image')),jsonb_build_array(jsonb_build_object('description','https://example.com')));
  begin
    insert into public.drafts(created_by_id,media) values(actor,jsonb_build_array(jsonb_build_object('url','/unreviewed.jpg','type','image')));
    raise exception 'Relative draft URL bypass was accepted';
  exception when insufficient_privilege then null; end;
  reset role;
  perform public.finish_media_moderation((public.reserve_media_moderation(actor,repeat('b',64),'sql-test')->>'id')::uuid,'rejected','sexual_content');
  if public.reserve_media_moderation(actor,repeat('b',64),'sql-test')->>'rejected'<>'true' then raise exception 'Rejected cache failed'; end if;
  -- Legacy media registered before rollout remains available.
  if exists(select 1 from storage.objects o where bucket_id='media' and not exists(select 1 from private.approved_media a where a.path=o.name)) then
    raise exception 'Existing media not registered';
  end if;
end $$;
rollback;
select 'PASS: service-only moderation, serialized reservations, approved media, item/draft/avatar bypass denial, rejected cache, legacy preservation and rollback' result;
