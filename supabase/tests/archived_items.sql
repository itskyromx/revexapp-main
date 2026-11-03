begin;
do $$
declare v_owner uuid; v_buyer uuid; v_item uuid:=gen_random_uuid(); v_alias uuid:=gen_random_uuid(); v_order uuid; affected integer;
begin
  select o.id,b.id into v_owner,v_buyer from public.profiles o cross join public.profiles b where o.id<>b.id
    and not exists(select 1 from public.blocks x where (x.blocker_id=o.id and x.blocked_id=b.id) or (x.blocker_id=b.id and x.blocked_id=o.id)) limit 1;
  if v_owner is null then raise exception 'Tests require two unblocked profiles'; end if;
  insert into public.items(id,post_id,created_by_id,title,price,image_urls)
  values(v_item,v_alias,v_owner,'Archive visibility test',10,array['https://example.invalid/item.jpg']);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.orders(item_id,buyer_id,seller_id,item_price) values(v_item,v_buyer,v_owner,10) returning id into v_order;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  set local role authenticated;
  update public.items set is_archived=true where id=v_item;
  if not exists(select 1 from public.items where id=v_item and created_by_id=v_owner and is_archived) then raise exception 'Owner cannot see archived item in profile'; end if;
  update public.items set title='Edited while archived' where id=v_item;
  if (select status from public.items where id=v_item)<>'available' then raise exception 'Archiving changed sale status'; end if;
  if (select image_urls[1] from public.items where id=v_item)<>'https://example.invalid/item.jpg' then raise exception 'Photos were changed'; end if;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated')::text,true);
  set local role authenticated;
  if exists(select 1 from public.items where id=v_item) then raise exception 'Other user can see archived item'; end if;
  if exists(select 1 from public.posts where id=v_alias) then raise exception 'Legacy view exposes archived item'; end if;
  if public.resolve_item_id(v_alias) is not null then raise exception 'Legacy link resolves private item for another user'; end if;
  update public.items set is_archived=false where id=v_item;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Other user unarchived the item'; end if;
  if not exists(select 1 from public.orders where id=v_order) then raise exception 'Existing order became inaccessible'; end if;
  begin
    perform public.toggle_item_like(v_item);
    raise exception 'Archived like allowed' using errcode='22000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_item_share(v_item);
    raise exception 'Archived share allowed' using errcode='22000';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.saved(user_id,kind,target_id) values(v_buyer,'item',v_item);
    raise exception 'Archived bookmark allowed' using errcode='22000';
  exception when raise_exception then null; end;
  begin
    insert into public.offers(item_id,buyer_id,seller_id,amount) values(v_item,v_buyer,v_owner,5);
    raise exception 'Archived offer allowed' using errcode='22000';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.orders(item_id,buyer_id,seller_id,item_price) values(v_item,v_buyer,v_owner,10);
    raise exception 'Archived order allowed' using errcode='22000';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  set local role anon;
  if exists(select 1 from public.items where id=v_item) then raise exception 'Guest can see archived item'; end if;
  begin
    perform public.record_item_view(v_item);
    raise exception 'Guest counted archived view' using errcode='22000';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  set local role authenticated;
  update public.items set is_archived=false where id=v_item;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated')::text,true);
  set local role authenticated;
  if not exists(select 1 from public.items where id=v_item and not is_archived) then raise exception 'Unarchived item did not become visible'; end if;
  if public.resolve_item_id(v_alias)<>v_item then raise exception 'Unarchiving did not restore legacy link'; end if;
  reset role;
end $$;
rollback;
select 'PASS: archive/unarchive, owner editing/profile, other accounts and guests denied, legacy links, interaction/order/offer protection, existing orders preserved' as result;
