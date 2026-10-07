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

export async function getBlockDirection(userId, otherId) {
  if (!userId || !otherId) return null;
  const [{ data: asBlocker }, { data: asBlocked }] = await Promise.all([
    supabase.from('blocks').select('id').eq('blocker_id', userId).eq('blocked_id', otherId),
    supabase.from('blocks').select('id').eq('blocker_id', otherId).eq('blocked_id', userId),
  ]);
  if (asBlocker?.[0]) return "you";
  if (asBlocked?.[0]) return "them";
  return null;
}

export async function getBlockRelationship(userId, otherId) {
  return Boolean(await getBlockDirection(userId, otherId));
}

export function hideBlocked(list, blockedIds) {
  if (!blockedIds?.length) return list;
  return list.filter((r) => !blockedIds.includes(r.created_by_id));
}

export function isBlockedByUser(blocks, blockerId, blockedId) {
  if (!blockerId || !blockedId || !Array.isArray(blocks)) return false;
  return blocks.some((b) => b.blocker_id === blockerId && b.blocked_id === blockedId);
}

export function isBlockedPair(blocks, userId, otherId) {
  if (!userId || !otherId || !Array.isArray(blocks)) return false;
  return isBlockedByUser(blocks, userId, otherId) || isBlockedByUser(blocks, otherId, userId);
}

export async function setBlockRelationship(blockerId, blockedId) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  const [{ data: existingAsBlocker }, { data: existingAsBlocked }] = await Promise.all([
    supabase.from('blocks').select('id').eq('blocker_id', blockerId).eq('blocked_id', blockedId),
    supabase.from('blocks').select('id').eq('blocker_id', blockedId).eq('blocked_id', blockerId),
  ]);
  const existing = existingAsBlocker?.[0] || existingAsBlocked?.[0];
  if (existing) {
    const { error } = await supabase.from('blocks').delete().eq('id', existing.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  window.dispatchEvent(new Event('revex:block-changed'));
}

export async function clearBlockRelationship(blockerId, blockedId) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  const [{ data: existingAsBlocker }, { data: existingAsBlocked }] = await Promise.all([
    supabase.from('blocks').select('id').eq('blocker_id', blockerId).eq('blocked_id', blockedId),
    supabase.from('blocks').select('id').eq('blocker_id', blockedId).eq('blocked_id', blockerId),
  ]);
  const existing = existingAsBlocker?.[0] || existingAsBlocked?.[0];
  if (!existing) return;
  const { error } = await supabase.from('blocks').delete().eq('id', existing.id);
  if (error) throw error;
  window.dispatchEvent(new Event('revex:block-changed'));
}

export async function clearChatHistory(userId, otherId) {
  if (!userId || !otherId || userId === otherId) return;
  const clearedAt = new Date().toISOString();
  const { error } = await supabase.from('chat_clears').upsert({
    user_id: userId,
    other_id: otherId,
    cleared_at: clearedAt,
  }, { onConflict: 'user_id,other_id' });
  if (error) throw error;

  window.dispatchEvent(new Event('revex:chat-cleared'));
}
