import { supabase } from "@/api/supabaseClient";
import { toggleSave } from "@/hooks/useSaved";

/**
 * Toggle a bookmark and keep the denormalised count on the item/post in step.
 * Returns the new bookmarked state.
 */
export async function toggleBookmark(userId, kind, target) {
  return toggleSave(userId, kind, target.id);
}
