import { supabase } from "@/api/supabaseClient";
import { hasCookieConsent } from "@/lib/cookieConsent";

const viewedThisSession = new Set();

/**
 * Re-read denormalised counters from the items table after a feed function
 * returns. The feed function can expose stale values even when the row has
 * already been updated by another client. * @param {string[]} itemIds
 * @returns {Promise<Record<string, {
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number
 * }>>} */
export async function refreshItemCounters(itemIds) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("items")
    .select("id, like_count, bookmark_count, view_count, share_count")
    .in("id", ids);

  if (error) throw error;
  return Object.fromEntries((data || []).map((item) => [item.id, item]));
}

export async function toggleItemLike(itemId) {
  if (!itemId) return null;
  const { data, error } = await supabase.rpc("toggle_item_like", { p_item_id: itemId });
  if (error) throw error;
  return data;
}

/**
 * Count a view once per browser and item. Repeated renders must not create
 * duplicate view increments.
 * @param {string} itemId
 * @returns {Promise<{
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number
 * } | null>}
 */
export async function recordItemView(itemId) {
  if (!itemId) return null;

  const key = "revex-viewed-items";
  let viewed = [];
  const canRememberViews = hasCookieConsent("preferences");
  if (canRememberViews) {
    try {
      viewed = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      viewed = [];
    }
  }
  if (viewedThisSession.has(itemId) || viewed.includes(itemId)) return null;

  // Reserve the ID before awaiting: feed/detail effects can overlap.
  viewedThisSession.add(itemId);
  try {
    const { data: updated, error } = await supabase.rpc("record_item_view", { p_item_id: itemId });
    if (error) throw error;
    if (!updated) { viewedThisSession.delete(itemId); return null; }
    if (canRememberViews) {
      viewed.push(itemId);
      try { localStorage.setItem(key, JSON.stringify(viewed)); } catch {}
    }
    return updated;
  } catch (error) {
    viewedThisSession.delete(itemId);
    throw error;
  }
}

export async function recordItemShare(itemId) {
  if (!itemId) return null;
  const { data, error } = await supabase.rpc("record_item_share", { p_item_id: itemId });
  if (error) throw error;
  return data;
}
