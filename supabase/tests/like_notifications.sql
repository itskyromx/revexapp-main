-- All alerts and interaction changes in these tests are rolled back.
begin;
do $$
declare v_owner uuid; v_actor uuid; v_other uuid; v_item uuid:=gen_random_uuid(); v_alias uuid:=gen_random_uuid(); v_count integer;
begin
  select o.id,a.id into v_owner,v_actor from public.profiles o cross join public.profiles a
  where o.id<>a.id and not exists(select 1 from public.blocks b where
    (b.blocker_id=o.id and b.blocked_id=a.id) or (b.blocker_id=a.id and b.blocked_id=o.id)) limit 1;
  select id into v_other from public.profiles p where id not in (v_owner,v_actor)
    and not exists(select 1 from public.blocks b where
      (b.blocker_id=v_owner and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=v_owner)) limit 1;
  if v_owner is null or v_other is null then raise exception 'Tests require three unblocked profiles'; end if;
  insert into public.items(id,post_id,created_by_id,title,price) values(v_item,v_alias,v_owner,'Notification regression test',10);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  set local role authenticated;
  perform public.toggle_item_like(v_item);
  perform public.toggle_item_like(v_item);
  perform public.toggle_item_like(v_item);
  reset role;
  select count(*) into v_count from public.notifications where type='like' and target_id=v_item::text;
  if v_count<>1 then raise exception 'Repeated likes generated % notifications',v_count; end if;
  if (select like_count from public.items where id=v_item)<>1 then raise exception 'Like count changed incorrectly'; end if;

  -- An old client still sending the separate notification cannot duplicate it.
  insert into public.notifications(recipient_id,actor_id,type,title,target_type,target_id)
  values(v_owner,v_actor,'like','Legacy like','post',v_alias::text);
  if (select count(*) from public.notifications where type='like' and target_id=v_item::text)<>1 then raise exception 'Legacy client duplicated the alert'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  set local role authenticated;
  delete from public.notifications where target_id=v_item::text;
  reset role;
  if (select count(*) from private.item_like_notification_history where item_id=v_item)<>1 then raise exception 'Dismissing the notification removed the history'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  set local role authenticated;
  perform public.toggle_item_like(v_item); perform public.toggle_item_like(v_item);
  reset role;
  if exists(select 1 from public.notifications where target_id=v_item::text) then raise exception 'Dismissed notification was sent again'; end if;

  -- No actual like: the notification API must not poison another user's key.
  insert into public.notifications(recipient_id,actor_id,type,title,target_type,target_id)
  values(v_owner,v_other,'like','Not a real like','item',v_item::text);
  if exists(select 1 from private.item_like_notification_history where item_id=v_item and actor_id=v_other) then raise exception 'A notification without a like reserved the key'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  set local role authenticated;
  perform public.toggle_item_like(v_item);
  reset role;
  if (select count(*) from public.notifications where target_id=v_item::text)<>1 then raise exception 'Another user should generate their own first notification'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  set local role authenticated;
  perform public.toggle_item_like(v_item);
  reset role;
  if (select count(*) from public.notifications where target_id=v_item::text)<>1 then raise exception 'Owner was notified about their own like'; end if;
  set local role anon;
  begin
    perform 1 from private.item_like_notification_history;
    raise exception 'Anonymous access to notification history allowed';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
rollback;
select 'PASS: first like only, unlike/re-like, legacy client, dismissal, separate actors, self likes, private history' as result;
