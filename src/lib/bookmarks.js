import { supabase } from "@/api/supabaseClient";
import { toggleSave } from "@/hooks/useSaved";

/**
 * Toggle a bookmark and keep the denormalised count on the item/post in step.
 * Returns the new bookmarked state.
 */
export async function toggleBookmark(userId, kind, target) {
  const next = await toggleSave(userId, kind, target.id);
  const current = Number(target.bookmark_count) || 0;
  const value = Math.max(0, current + (next ? 1 : -1));
  const table = kind === "item" ? "items" : "posts";
  supabase.from(table).update({ bookmark_count: value }).eq('id', target.id).then(() => {});
  return next;
}
