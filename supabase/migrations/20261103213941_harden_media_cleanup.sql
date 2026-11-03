begin;
set local lock_timeout='5s';
create policy media_cleanup_config_service_only on private.media_cleanup_config
  to service_role using(true) with check(true);
create policy media_cleanup_queue_service_only on private.media_cleanup_queue
  to service_role using(true) with check(true);
commit;
