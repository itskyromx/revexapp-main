-- Fix mutable search_path warnings on SECURITY DEFINER functions
alter function public.handle_new_user() set search_path = public;
alter function public.is_admin() set search_path = public;

-- handle_new_user only makes sense as a trigger (it references NEW), so it
-- should never be callable directly via the PostgREST RPC endpoint.
revoke execute on function public.handle_new_user() from anon, authenticated;
