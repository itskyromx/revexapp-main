-- Run on a database with this migration applied. Every test is rolled back.
begin;
do $$
declare
  owner_id uuid; other_id uuid; test_id uuid:=gen_random_uuid(); legacy_id uuid:=gen_random_uuid();
  published_id uuid:=gen_random_uuid(); result jsonb; n integer; expiry timestamptz; same_expiry timestamptz;
begin
  select id into owner_id from public.profiles order by id limit 1;
  select id into other_id from public.profiles where id<>owner_id order by id limit 1;
  if owner_id is null or other_id is null then raise exception 'Tests require two existing profiles'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.items(id,created_by_id,title,description,price,image_urls)
  values(test_id,owner_id,'Migration test','Rollback only',10,array['https://example.invalid/cover.jpg','https://example.invalid/second.jpg']);
  if (select image_url from public.items where id=test_id)<>'https://example.invalid/cover.jpg' then raise exception 'Cover sync failed'; end if;
  update public.items set title='Edited item',image_urls=array['https://example.invalid/new.jpg'] where id=test_id;
  if (select image_url from public.items where id=test_id)<>'https://example.invalid/new.jpg' then raise exception 'Photo edit failed'; end if;
  begin
    update public.items set boost_expires_at=now()+interval '7 days' where id=test_id;
    raise exception 'Owner was allowed to forge a paid boost';
  exception when insufficient_privilege then null; end;
  result:=public.toggle_item_like(test_id);
  if not (result->>'liked')::boolean or (result->>'like_count')::integer<>1 then raise exception 'Like failed'; end if;
  result:=public.toggle_item_like(test_id);
  if (result->>'liked')::boolean or (result->>'like_count')::integer<>0 then raise exception 'Unlike failed'; end if;
  perform public.record_item_share(test_id); perform public.record_item_share(test_id);
  if (select share_count from public.items where id=test_id)<>1 then raise exception 'Share counted twice'; end if;
  insert into public.saved(user_id,kind,target_id) values(owner_id,'item',test_id);
  if (select bookmark_count from public.items where id=test_id)<>1 then raise exception 'Bookmark count failed'; end if;
  delete from public.saved where user_id=owner_id and target_id=test_id;
  if (select bookmark_count from public.items where id=test_id)<>0 then raise exception 'Unbookmark count failed'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
  update public.items set title='Not the owner' where id=test_id;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Another user edited the item'; end if;
  begin
    perform public.delete_item(test_id);
    raise exception 'Another user deleted the item';
  exception when insufficient_privilege then null; end;

  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true);
  set local role anon;
  perform public.record_item_view(test_id);
  if (select view_count from public.items where id=test_id)<>1 then raise exception 'Public view failed'; end if;
  begin
    perform public.toggle_item_like(test_id);
    raise exception 'Anonymous like allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from private.posts_before_item_unification;
    raise exception 'Anonymous archive access allowed';
  exception when insufficient_privilege then null; end;

  reset role;
  set local role service_role;
  expiry:=public.apply_item_boost(test_id,'migration-test-session',24);
  same_expiry:=public.apply_item_boost(test_id,'migration-test-session',24);
  if expiry is distinct from same_expiry or expiry is null then raise exception 'Boost was applied twice'; end if;
  reset role;
  update public.items set status='reserved' where id=test_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  set local role authenticated;
  begin
    perform public.delete_item(test_id);
    raise exception 'Reserved item deletion allowed' using errcode='22000';
  exception when raise_exception then null; end;
  reset role;
  update public.items set status='available' where id=test_id;
  set local role authenticated;
  insert into public.saved(user_id,kind,target_id) values(owner_id,'item',test_id);
  result:=public.delete_item(test_id);
  if result->>'ok'<>'true' then raise exception 'Deletion failed'; end if;
  if exists(select 1 from public.items where id=test_id) or exists(select 1 from public.saved where target_id=test_id) then raise exception 'Deleted item/bookmark remains'; end if;

  -- An old client can finish its two-write publication without duplicate items.
  insert into public.posts(id,created_by_id,haul_title,caption,image_urls,category)
  values(legacy_id,owner_id,'Legacy client','Legacy description',array['https://example.invalid/one.jpg','https://example.invalid/two.jpg'],'shirts');
  insert into public.items(id,post_id,created_by_id,title,price,image_url)
  values(published_id,legacy_id,owner_id,'Legacy client',12,'https://example.invalid/one.jpg');
  if public.resolve_item_id(legacy_id)<>published_id then raise exception 'Legacy link resolution failed'; end if;
  if exists(select 1 from public.items where id=legacy_id) then raise exception 'Legacy placeholder duplicated'; end if;
  if (select cardinality(image_urls) from public.items where id=published_id)<>2 then raise exception 'Legacy photo migration failed'; end if;
  update public.posts set haul_title='Legacy edit',image_urls=array['https://example.invalid/edit.jpg'] where id=legacy_id;
  if (select title from public.items where id=published_id)<>'Legacy edit' then raise exception 'Legacy edit failed'; end if;
  perform public.toggle_post_like(legacy_id);
  if (select like_count from public.items where id=published_id)<>1 then raise exception 'Legacy like failed'; end if;
  perform public.delete_item(published_id);
  reset role;
end $$;
rollback;
select 'PASS: publication, editing, photos, likes, shares, bookmarks, ownership, anonymous permissions, paid boosts, deletion and legacy compatibility' as result;
