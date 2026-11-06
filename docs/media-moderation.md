# Photo moderation

New photos go to `moderateMedia` as authenticated multipart requests, never
straight to public Storage. The server validates bytes, MIME signature, 5 MiB,
4096 px per axis and still JPEG/PNG/WebP images. AVIF uploads are converted to
JPEG in the browser before review; the reviewed JPEG is what gets stored.
It sends the image bytes (not the
user's filename, account profile or public URL) to OpenAI. Explicitly rejected
images never enter Storage. Provider failures, refusals, invalid responses and
ambiguous decisions fail closed. Approved bytes are uploaded to an immutable,
random path and registered before the client receives a public URL.

Rules (`revex-fashion-2026-11-05-1`): ordinary fashion models, portraits,
underwear, lingerie and swimwear are allowed. Explicit nudity, sexual content,
sexualized minors, graphic violence and hateful/extremist imagery are blocked.
`omni-moderation-latest` screens supported image categories; the pinned
`gpt-4.1-mini-2025-04-14` vision model handles fashion context, visible hateful
symbols and other image categories not supported by the moderation endpoint.
Never assume unsupported image categories are safe because their score is zero.

The vision request uses structured output, `store: false`, a bounded output,
and no tools. Instructions inside a photo are untrusted. OpenAI's API data
policies still apply; `store: false` is not a promise of zero provider retention.
Vision classification incurs API charges. No claim of perfect detection is
made: tune/evaluate the policy on representative, consented fashion examples.
There is no admin review queue in this release: ambiguous photos are not saved,
and the uploader can choose a clearer photo or use the existing support channel.

Each account is limited to 20 new checks per 10 minutes and 200 per rolling day.
Reservations are serialized in Postgres to prevent concurrent quota bypass.
Recent checks with the same account/hash/policy reuse a rejection or an existing
approved object. The audit contains only account ID, SHA-256, policy version,
decision, reason and timestamp, and is purged after 30 days. Approved-path
records remain for the life of the stored media. The existing cleanup worker
removes unused approved files. Raw rejected bytes are not persisted by Revex.

## Deployment order

1. Apply the moderation migrations and deploy `moderateMedia` with JWT
   verification enabled. They are already applied/deployed to the Revex project.
2. Verify that `OPENAI_API_KEY` is configured in Supabase Edge Function secrets
   and has access to the two models. Never add it to Vite or commit it. The
   existing OpenAI integration uses this same secret; its presence/value was
   not verified through the management API in this session.
3. Publish the frontend, including the upload notices and privacy/cookie policy
   updates. Its multipart `policyVersion` must match `POLICY_VERSION` server-side.
4. Sign in and test a normal product photo/avatar. Check that an approved file
   appears under `items/USER_ID/...` or `avatars/USER_ID/...` and that an API
   outage returns a friendly error, never an unmoderated upload.
5. After this smoke test, run in the Supabase SQL Editor:

   ```sql
   select private.activate_media_moderation();
   ```

   This activates restrictive Storage INSERT/UPDATE policies and database
   reference guards. Public clients can no longer upload/overwrite directly,
   and new item/draft/avatar URLs must be approved or registered legacy media.
   Existing public images are grandfathered; no retroactive scan is performed.
   Old open browser tabs may need refreshing after activation.

Before step 5, direct uploads are still allowed for compatibility with the
currently deployed frontend. Do not describe moderation as fully enforced until
activation is complete. Normal product edits can retain existing external
legacy URLs; newly introduced external/data/blob URLs are rejected. Service-role
operations remain trusted, including the existing duplicate cleanup worker.

The registry uses the project's origin configured in
`private.media_cleanup_config.endpoint`; configure that value in new environments.
The existing cleanup and cron migrations are prerequisites.

## Verification

`node scripts/verify-media-moderation.mjs` runs the actual server handler with
controlled provider/auth/storage dependencies. It tests rejection categories,
malformed/failed responses, quotas, hash cache, upload ordering and rollback.
It does not call OpenAI or verify live model classification accuracy.
`supabase/tests/media_moderation.sql` tests service-only decisions, concurrent
reservations, URL guards and legacy preservation, rolling back its fixtures.

The required photo safety processing is disclosed beside uploads, in the data
inventory and privacy/cookie policies, and does not use personalization consent.
Optional OpenAI search/recommendation/video analysis remains consent-gated.
