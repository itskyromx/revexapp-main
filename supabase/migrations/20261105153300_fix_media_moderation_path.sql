create or replace function private.require_approved_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare fields text[]; key text; value jsonb; old_value jsonb; image text; prefix text; v_path text;
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
      v_path:=private.decode_media_path(split_part(split_part(substr(image,length(prefix)+1),'?',1),'#',1));
      if not exists(select 1 from private.approved_media where approved_media.path=v_path) then
        raise exception 'Image has not passed the safety check' using errcode='42501';
      end if;
    end loop;
  end loop;
  return new;
end $$;
