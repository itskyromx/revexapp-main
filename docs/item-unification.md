# Unified items

`public.items` is the only live listing/feed entity. Publication and editing
write one row, including `image_urls`, the cover `image_url`, description,
commercial fields and social counters. Feed and catalog use the same item ID.

The migration preserves the existing item IDs, order references, images,
likes and shares. Former post bookmarks are converted to item bookmarks and
duplicates belonging to the same user are merged. `item_likes` and
`item_shares` reference `items.id`. Reports and warnings use `item_id` and
`item_title`. Drafts use `title` and `description`.

## Compatibility

- `/haul/:legacyId` resolves to `/item/:itemId`, retaining query parameters so
  payment returns already in flight still work.
- `items.post_id` is a legacy URL alias, not a relationship to a separate entity.
- `posts`, `post_likes` and `post_shares` are security-invoker compatibility
  views. Old RPC names and Edge Function names adapt to the item implementation.
- `getFeed` returns canonical `items`; its additional legacy `posts` payload is
  retained for already-open versions of the frontend. The feed remains public,
  as before this migration.
- Legacy two-step publication is supported temporarily through view triggers.
  It replaces the intermediate row without duplicating the final listing.
- A private snapshot of the three former posts lives in
  `private.posts_before_item_unification`. Client roles cannot read it. Item
  deletion also removes the associated snapshot. This snapshot is not a full
  database backup or an automatic rollback procedure.

## Mutations and verification

Likes, shares, views and deletion use item RPCs. Clients cannot directly assign
paid boosts or fabricate counters. Bookmark counts follow the saved rows.
Stripe session identifiers live in a private ledger; applying the same paid
boost twice does not extend its duration twice. Items with orders or a
reservation cannot be deleted.

Run `supabase/tests/item_unification.sql` against a database with two test
profiles. All changes in the test are rolled back. It covers publication,
editing, photos, ownership, public read/view access, social counters, private
archive access, boost replay, deletion and legacy publication/links.

`node scripts/verify-item-api.mjs` performs a read-only HTTP check using the
public Vite environment: canonical feed/REST payloads, the compatibility feed
payload and rejection of anonymous boost/delete requests. It never starts a
payment or deletes a listing.

The three migrations have been applied to the connected Revex project and
the affected Edge Functions published. Publish the frontend through the
existing Cloudflare workflow to release the new client code. No frontend
deployment is performed by this change.
