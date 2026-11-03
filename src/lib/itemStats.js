import { supabase } from "@/api/supabaseClient";
import { hasCookieConsent } from "@/lib/cookieConsent";

const viewedThisSession = new Set();
const VIEWED_ITEMS_KEY = "revex-viewed-items";

function rememberedViews() {
  if (!hasCookieConsent("preferences")) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(VIEWED_ITEMS_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Re-read denormalised counters from the items table after a feed function
 * returns. The feed function can expose stale values even when the row has
 * already been updated by another client. * @param {string[]} itemIds
 * @returns {Promise<Record<string, {
 *   id: string,
 *   like_count: number,
 *   bookmark_count: number,
 *   view_count: number,
 *   share_count: number,
 *   is_archived: boolean
 * }>>} */
export async function refreshItemCounters(itemIds) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("items")
    .select("id, like_count, bookmark_count, view_count, share_count, is_archived")
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
 * Deduplicate qualified views across feed/detail mounts in this page session.
 * Persist deduplication across visits only with preferences consent.
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

  if (viewedThisSession.has(itemId) || rememberedViews().includes(itemId)) return null;

  // Reserve the ID before awaiting: feed/detail effects can overlap.
  viewedThisSession.add(itemId);
  try {
    const { data: updated, error } = await supabase.rpc("record_item_view", { p_item_id: itemId });
    if (error) throw error;
    if (!updated) { viewedThisSession.delete(itemId); return null; }
    if (hasCookieConsent("preferences")) {
      // Other qualified items may have finished while this request was pending.
      const viewed = [...new Set([...rememberedViews(), itemId])];
      try { localStorage.setItem(VIEWED_ITEMS_KEY, JSON.stringify(viewed)); } catch {}
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
