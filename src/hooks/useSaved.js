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
let generation = 0;
const listeners = new Set();

function emit() {
  const snapshot = { ownerId, rows: [...rows] };
  listeners.forEach((fn) => fn(snapshot));
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadSaves(userId) {
  if (!userId) {
    if (ownerId !== null) {
      generation += 1;
      ownerId = null;
      rows = [];
      inFlight = null;
      emit();
    }
    return;
  }
  if (ownerId !== userId) {
    generation += 1;
    ownerId = userId;
    rows = [];
    inFlight = null;
    emit();
  }
  if (inFlight) return inFlight;
  const requestGeneration = generation;
  const request = supabase.from('saved').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(300)
    .then(({ data, error }) => {
      if (requestGeneration !== generation || ownerId !== userId) return;
      if (error) throw error;
      rows = data || [];
      emit();
    })
    .catch((e) => console.error(e))
    .finally(() => { if (inFlight === request) inFlight = null; });
  inFlight = request;
  return request;
}

async function reload(userId) {
  generation += 1;
  inFlight = null;
  ownerId = null;
  await loadSaves(userId);
}

/** Bookmark or un-bookmark something. Returns the new state. */
export async function toggleSave(userId, kind, targetId) {
  if (!userId) return false;
  if (ownerId !== userId || inFlight) await loadSaves(userId);
  if (ownerId !== userId) return false;
  const actionGeneration = generation;

  const existing = rows.find((r) => r.kind === kind && r.target_id === targetId);
  if (existing) {
    rows = rows.filter((r) => r.id !== existing.id);
    emit();
    try {
      const { error } = await supabase.from('saved').delete().eq('id', existing.id);
      if (error) throw error;
    } catch (e) {
      if (ownerId === userId && generation === actionGeneration) await reload(userId);
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
    if (ownerId !== userId || generation !== actionGeneration) return true;
    rows = rows.map((r) => (r.id === tempId ? created : r));
    emit();
  } catch (e) {
    if (ownerId === userId && generation === actionGeneration) await reload(userId);
    throw e;
  }
  return true;
}

export function useSaved(userId) {
  const [snapshot, setSnapshot] = useState(() => ({ ownerId, rows: [...rows] }));

  useEffect(() => {
    const unsubscribe = subscribe(setSnapshot);
    loadSaves(userId);
    setSnapshot({ ownerId, rows: [...rows] });
    return unsubscribe;
  }, [userId]);

  const visibleRows = userId && snapshot.ownerId === userId
    ? snapshot.rows.filter(row => row.user_id === userId)
    : [];
  return {
    saves: visibleRows,
    isSaved: (kind, targetId) => visibleRows.some((r) => r.kind === kind && r.target_id === targetId),
    toggle: (kind, targetId) => toggleSave(userId, kind, targetId),
  };
}
