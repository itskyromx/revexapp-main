import { supabase, getCurrentUserProfile } from "@/api/supabaseClient";

/**
 * Blocking is mutual invisibility. This returns the ids of everyone blocked in
 * either direction so their posts can be hidden from feeds, search and profiles.
 */
export async function getBlockedIds(userId) {
  try {
    let id = userId;
    if (!id) {
      const me = await getCurrentUserProfile().catch(() => null);
      id = me?.id;
    }
    if (!id) return [];
    const [{ data: asBlocker }, { data: asBlocked }] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', id),
    ]);
    return [
      ...new Set([
        ...(asBlocker || []).map((b) => b.blocked_id),
        ...(asBlocked || []).map((b) => b.blocker_id),
      ]),
    ].filter(Boolean);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function hideBlocked(list, blockedIds) {
  if (!blockedIds?.length) return list;
  return list.filter((r) => !blockedIds.includes(r.created_by_id));
}
