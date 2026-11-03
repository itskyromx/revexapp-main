alter table public.items
  add column if not exists description text not null default '',
  add column if not exists gender text not null default 'unisex',
  add column if not exists subcategory text not null default '',
  add column if not exists styles text[] not null default '{}';

alter table public.items
  drop constraint if exists items_gender_check,
  add constraint items_gender_check check (gender in ('men', 'women', 'unisex'));

create index if not exists items_gender_category_subcategory_idx
  on public.items (gender, category, subcategory);
create index if not exists items_brand_lower_idx
  on public.items (lower(brand))
  where brand is not null and brand <> '';
create index if not exists items_styles_gin_idx
  on public.items using gin (styles);
