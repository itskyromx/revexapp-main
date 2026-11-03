alter table public.profiles add column if not exists style_preferences text[] default '{}';
alter table public.profiles add column if not exists favorite_brands text[] default '{}';
