import { useCallback, useEffect, useMemo, useState } from "react";
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
let loadError = null;
const mutations = new Map();
const listeners = new Set();

function currentSnapshot() {
  return { ownerId, rows: [...rows], loading: Boolean(inFlight), error: loadError };
}

function emit() {
  const snapshot = currentSnapshot();
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
      loadError = null;
      mutations.clear();
      emit();
    }
    return;
  }
  if (ownerId !== userId) {
    generation += 1;
    ownerId = userId;
    rows = [];
    inFlight = null;
    loadError = null;
    mutations.clear();
    emit();
  }
  if (inFlight) return inFlight;
  const pendingMutations = [...mutations.entries()]
    .filter(([key]) => key.startsWith(`${userId}:`)).map(([, operation]) => operation);
  if (pendingMutations.length) {
    const refreshGeneration = generation;
    return Promise.allSettled(pendingMutations).then(() => {
      if (ownerId === userId && generation === refreshGeneration) return loadSaves(userId);
    });
  }
  loadError = null;
  const requestGeneration = generation;
  const request = supabase.from('saved').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(300)
    .then(({ data, error }) => {
      if (requestGeneration !== generation || ownerId !== userId) return;
      if (error) throw error;
      rows = data || [];
      emit();
    })
    .catch((error) => {
      if (requestGeneration === generation && ownerId === userId) loadError = error.message || "Could not load saved items.";
    })
    .finally(() => {
      if (inFlight === request) { inFlight = null; emit(); }
    });
  inFlight = request;
  emit();
  return request;
}

async function reload(userId) {
  generation += 1;
  inFlight = null;
  ownerId = null;
  await loadSaves(userId);
}

/** Bookmark or un-bookmark something. Returns the new state. */
export function toggleSave(userId, kind, targetId) {
  if (!userId) return Promise.resolve(false);
  const key = `${userId}:${kind}:${targetId}`;
  if (mutations.has(key)) return mutations.get(key);
  const operation = performToggle(userId, kind, targetId).finally(() => {
    if (mutations.get(key) === operation) mutations.delete(key);
  });
  mutations.set(key, operation);
  return operation;
}

async function performToggle(userId, kind, targetId) {
  if (!userId) return false;
  if (ownerId !== userId || inFlight) await loadSaves(userId);
  if (ownerId !== userId) return false;
  if (loadError) throw new Error(loadError);
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
  const [snapshot, setSnapshot] = useState(currentSnapshot);

  useEffect(() => {
    const unsubscribe = subscribe(setSnapshot);
    loadSaves(userId);
    setSnapshot(currentSnapshot());
    return unsubscribe;
  }, [userId]);

  const visibleRows = useMemo(() => userId && snapshot.ownerId === userId
    ? snapshot.rows.filter(row => row.user_id === userId)
    : [], [userId, snapshot.ownerId, snapshot.rows]);
  const refresh = useCallback(() => loadSaves(userId), [userId]);
  return {
    saves: visibleRows,
    loading: Boolean(userId && (snapshot.ownerId !== userId || snapshot.loading)),
    error: userId && snapshot.ownerId === userId ? snapshot.error : null,
    refresh,
    isSaved: (kind, targetId) => visibleRows.some((r) => r.kind === kind && r.target_id === targetId),
    toggle: (kind, targetId) => toggleSave(userId, kind, targetId),
  };
}
