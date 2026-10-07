import { supabase } from "@/api/supabaseClient";

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
    .select("id, like_count, bookmark_count, view_count")
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
  if (!postId || !["like_count", "bookmark_count", "view_count"].includes(counter)) return null;
  if (!Number.isInteger(delta) || delta === 0) return null;

  const { data: current, error: readError } = await supabase
    .from("posts")
    .select("like_count, bookmark_count, view_count")
    .eq("id", postId)
    .single();
  if (readError) throw readError;

  const currentValue = counter === "like_count"
    ? current.like_count
    : counter === "bookmark_count"
      ? current.bookmark_count
      : current.view_count;
  const nextValue = Math.max(0, (currentValue || 0) + delta);
  const { data, error } = await supabase
    .from("posts")
    .update({ [counter]: nextValue })
    .eq("id", postId)
    .select("id, like_count, bookmark_count, view_count")
    .single();
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
  try {
    viewed = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    viewed = [];
  }
  if (viewed.includes(postId)) return null;

  const updated = await updatePostCounter(postId, "view_count", 1);
  if (updated) {
    viewed.push(postId);
    localStorage.setItem(key, JSON.stringify(viewed));
  }
  return updated;
}
