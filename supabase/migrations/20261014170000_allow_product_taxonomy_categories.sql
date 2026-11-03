alter table public.posts
  drop constraint if exists posts_category_check;

alter table public.posts
  add constraint posts_category_check
  check (category = any (array[
    'hauls', 'try_on', 'streetwear', 'vintage', 'y2k', 'cottagecore', 'luxury', 'other',
    'coats', 'trousers', 'shirts', 'accessories', 'shoes', 'dresses'
  ]::text[]));

alter table public.items
  drop constraint if exists items_category_check;

alter table public.items
  add constraint items_category_check
  check (category = any (array[
    'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'other',
    'coats', 'trousers', 'shirts'
  ]::text[]));
