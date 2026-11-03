import { supabase } from "@/api/supabaseClient";
import { hasCookieConsent } from "@/lib/cookieConsent";

const viewedThisSession = new Set();

/**
 * Re-read denormalised counters from the posts table after a feed function
 * returns. The feed function can expose stale values even when the row has
 * already been updated by another client. * @param {string[]} postIds
 * @returns {Promise<Record<string, {
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number
 * }>>} */
export async function refreshPostCounters(postIds) {
  const ids = [...new Set(postIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("posts")
    .select("id, like_count, bookmark_count, view_count, share_count")
    .in("id", ids);

  if (error) throw error;
  return Object.fromEntries((data || []).map((post) => [post.id, post]));
}

/**
 * Apply a signed delta to one counter using the current database value. This
 * avoids stale client arithmetic and exact-value predicates during concurrent
 * updates from multiple clients.
 * @param {string} postId
 * @param {"like_count" | "bookmark_count" | "view_count"} counter
 * @param {number} delta
 * @returns {Promise<{
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number
 * } | null>}
 */
export async function updatePostCounter(postId, counter, delta) {
  if (!postId || !["bookmark_count", "view_count", "share_count"].includes(counter)) return null;
  if (!Number.isInteger(delta) || delta === 0) return null;

  const { data, error } = await supabase.rpc("increment_post_counter", {
    p_post_id: postId,
    p_counter: counter,
    p_delta: delta,
  });
  if (error) throw error;
  return data;
}

export async function togglePostLike(postId) {
  if (!postId) return null;
  const { data, error } = await supabase.rpc("toggle_post_like", { p_post_id: postId });
  if (error) throw error;
  return data;
}

/**
 * Count a view once per browser and post. Repeated renders must not create
 * duplicate view increments.
 * @param {string} postId
 * @returns {Promise<{
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number
 * } | null>}
 */
export async function recordPostView(postId) {
  if (!postId) return null;

  const key = "revex-viewed-posts";
  let viewed = [];
  const canRememberViews = hasCookieConsent("preferences");
  if (canRememberViews) {
    try {
      viewed = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      viewed = [];
    }
  }
  if (viewedThisSession.has(postId) || viewed.includes(postId)) return null;

  const updated = await updatePostCounter(postId, "view_count", 1);
  if (updated) {
    viewedThisSession.add(postId);
    if (canRememberViews) {
      viewed.push(postId);
      try { localStorage.setItem(key, JSON.stringify(viewed)); } catch {}
    }
  }
  return updated;
}

export async function recordPostShare(postId) {
  if (!postId) return null;
  const { data, error } = await supabase.rpc("record_post_share", { p_post_id: postId });
  if (error) throw error;
  return data;
}
