with ranked_clears as (
  select ctid, row_number() over (
    partition by user_id, other_id
    order by cleared_at desc nulls last, id desc
  ) as row_num
  from public.chat_clears
)
delete from public.chat_clears c
using ranked_clears r
where c.ctid = r.ctid and r.row_num > 1;

alter table public.chat_clears
  add constraint chat_clears_user_id_other_id_key unique (user_id, other_id);
