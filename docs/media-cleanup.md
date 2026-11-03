# Media cleanup

Deleting an item or draft queues its media URLs in the same database transaction.
After commit, pg_net invokes `cleanupMedia`. The worker uses the Storage API to
remove files only after rechecking all current references. SQL never deletes
`storage.objects` rows directly. Archived listings, drafts, profiles, orders,
offers, notifications and moderation snapshots keep their referenced media.

An hourly cron retries failures and removes unreferenced images older than 24
hours. The grace period protects uploads before their draft is saved. Media
queued by an explicit deletion does not need to wait 24 hours.

The worker uses a dedicated random credential in `private.media_cleanup_config`.
It authenticates requests itself; cleanup RPCs are executable only by
`service_role`. Never expose the credential or service key to the browser.

Deploy the worker with `--no-verify-jwt`, retaining its own credential check.
In each environment, configure only the endpoint (the database generates the
credential):

```sql
update private.media_cleanup_config
set endpoint = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanupMedia'
where singleton;
```

An administrator can inspect a cleanup without applying changes:

```sql
select private.request_media_cleanup(true, false);
-- Use the returned request ID; response bodies contain no credentials.
select id, status_code, content, error_msg from net._http_response where id = YOUR_REQUEST_ID;
```

After review, `private.request_media_cleanup(true, true)` applies cleanup and
deduplication. Duplicate candidates must be older than 24 hours and match both
metadata and a SHA-256 of downloaded bytes. References are repointed before
copies are removed. The normal hourly job does not rewrite duplicate references.
Files still referenced after a replacement are retained. No public listing,
draft or order is deleted by maintenance.

Verify locally with `node scripts/verify-media-cleanup.mjs` and run
`supabase/tests/media_cleanup.sql` against a test database. SQL fixtures roll
back, including queued HTTP requests.
