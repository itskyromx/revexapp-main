import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";

/**
 * Bookmarks live in the account (Saved rows) so they follow the user across
 * devices. Everything reads from one shared list, otherwise every card in a
 * feed would fire its own request.
 */
let rows = [];
let ownerId = null;
let inFlight = null;
const listeners = new Set();

function emit() {
  const snapshot = [...rows];
  listeners.forEach((fn) => fn(snapshot));
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadSaves(userId) {
  if (!userId) return;
  if (ownerId !== userId) {
    ownerId = userId;
    rows = [];
    inFlight = null;
    emit();
  }
  if (inFlight) return inFlight;
  inFlight = supabase.from('saved').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(300)
    .then(({ data, error }) => { if (error) throw error; rows = data || []; emit(); })
    .catch((e) => console.error(e))
    .finally(() => { inFlight = null; });
  return inFlight;
}

async function reload(userId) {
  inFlight = null;
  ownerId = null;
  await loadSaves(userId);
}

/** Bookmark or un-bookmark something. Returns the new state. */
export async function toggleSave(userId, kind, targetId) {
  if (!userId) return false;

  const existing = rows.find((r) => r.kind === kind && r.target_id === targetId);
  if (existing) {
    rows = rows.filter((r) => r.id !== existing.id);
    emit();
    try {
      const { error } = await supabase.from('saved').delete().eq('id', existing.id);
      if (error) throw error;
    } catch (e) {
      await reload(userId);
      throw e;
    }
    return false;
  }

  const tempId = `temp-${kind}-${targetId}`;
  rows = [{ id: tempId, user_id: userId, kind, target_id: targetId }, ...rows];
  emit();
  try {
    const { data: created, error } = await supabase.from('saved')
      .insert({ user_id: userId, kind, target_id: targetId }).select().single();
    if (error) throw error;
    rows = rows.map((r) => (r.id === tempId ? created : r));
    emit();
  } catch (e) {
    await reload(userId);
    throw e;
  }
  return true;
}

export function useSaved(userId) {
  const [snapshot, setSnapshot] = useState(rows);

  useEffect(() => {
    if (!userId) return undefined;
    loadSaves(userId);
    return subscribe(setSnapshot);
  }, [userId]);

  return {
    saves: snapshot,
    isSaved: (kind, targetId) => snapshot.some((r) => r.kind === kind && r.target_id === targetId),
    toggle: (kind, targetId) => toggleSave(userId, kind, targetId),
  };
}
