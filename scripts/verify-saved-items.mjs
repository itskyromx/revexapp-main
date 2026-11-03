import assert from 'node:assert/strict';
import fs from 'node:fs';

// Deferred requests exercise the actual hook/store under overlapping reads,
// mutations and account changes, without contacting a user's database.
const requests = [];
const client = { from() {
  return {
    mode: 'read', filters: {},
    select() { return this; }, order() { return this; }, limit() { return this; },
    eq(key, value) { this.filters[key] = value; return this; },
    insert(payload) { this.mode = 'insert'; this.payload = payload; return this; },
    delete() { this.mode = 'delete'; return this; },
    single() { return this.run(); },
    then(resolve, reject) { return this.run().then(resolve, reject); },
    run() {
      if (!this.promise) this.promise = new Promise(resolve => requests.push({ mode: this.mode, filters: this.filters, payload: this.payload, resolve }));
      return this.promise;
    },
  };
} };
let current;
const react = {
  useState(initial) {
    const runner = current; const slot = runner.index++;
    if (!(slot in runner.slots)) runner.slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [runner.slots[slot], value => { runner.slots[slot] = typeof value === 'function' ? value(runner.slots[slot]) : value; }];
  },
  useEffect(callback, deps) {
    const runner = current; const slot = runner.index++; const previous = runner.slots[slot];
    if (!previous || deps.some((value, index) => value !== previous.deps[index])) runner.effects.push(() => {
      previous?.cleanup?.(); runner.slots[slot] = { deps, cleanup: callback() };
    });
  },
  useMemo(factory, deps) {
    const runner = current; const slot = runner.index++; const previous = runner.slots[slot];
    if (!previous || deps.some((value, index) => value !== previous.deps[index])) runner.slots[slot] = { deps, value: factory() };
    return runner.slots[slot].value;
  },
  useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
};
globalThis.__savedItemsTest = { react, client };
const source = fs.readFileSync(new URL('../src/hooks/useSaved.js', import.meta.url), 'utf8')
  .replace(/^import .*from "react";\r?\n/m, 'const {useState,useEffect,useMemo,useCallback}=globalThis.__savedItemsTest.react;\n')
  .replace(/^import .*supabaseClient.*\r?\n/m, 'const supabase=globalThis.__savedItemsTest.client;\n');
const { useSaved, loadSaves, toggleSave } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const runner = { slots: [], index: 0, effects: [] };
const render = userId => {
  current = runner; runner.index = 0; runner.effects = [];
  const result = useSaved(userId); runner.effects.forEach(effect => effect()); return result;
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const row = (id, userId = 'A') => ({ id: `saved-${id}`, user_id: userId, kind: 'item', target_id: id });

try {
  render('A');
  const initial = loadSaves('A');
  requests.shift().resolve({ data: [row('old')] }); await initial;
  const loaded = render('A');
  assert.equal(loaded.loading, false);
  assert.equal(loaded.isSaved('item', 'old'), true);
  assert.equal(render('A').saves, loaded.saves, 'Unrelated renders must retain the list identity, preventing endless SavedTab reloads');
  assert.equal(requests.length, 0);

  const insert = toggleSave('A', 'item', 'new');
  assert.equal(toggleSave('A', 'item', 'new'), insert, 'Repeated taps must share one mutation');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].mode, 'insert');
  const refresh = loadSaves('A');
  assert.equal(requests.length, 1, 'A refresh must wait for an outstanding save');
  requests.shift().resolve({ data: row('new') }); await insert; await flush();
  assert.equal(requests.length, 1);
  requests.shift().resolve({ data: [row('new'), row('old')] }); await refresh;
  assert.equal(render('A').saves.length, 2);

  const remove = toggleSave('A', 'item', 'new');
  const rejected = assert.rejects(remove, /denied/);
  await flush(); requests.shift().resolve({ error: new Error('denied') }); await flush();
  requests.shift().resolve({ data: [row('new'), row('old')] }); await rejected;
  assert.equal(render('A').isSaved('item', 'new'), true, 'Failed deletion must restore the server state');

  const failure = loadSaves('A');
  requests.shift().resolve({ error: new Error('network error') }); await failure;
  const failedState = render('A');
  assert.equal(failedState.loading, false);
  assert.equal(failedState.error, 'network error', 'Loading errors must be visible rather than showing an empty list');
  const retry = failedState.refresh(); requests.shift().resolve({ data: [row('old')] }); await retry;
  assert.equal(render('A').error, null);

  const stale = loadSaves('A'); const delayed = requests.shift();
  await loadSaves(null);
  const nextAccount = loadSaves('B');
  requests.shift().resolve({ data: [row('b', 'B')] }); await nextAccount;
  delayed.resolve({ data: [row('old')] }); await stale;
  assert.equal(render('B').isSaved('item', 'b'), true);
  assert.equal(render('B').isSaved('item', 'old'), false);
  assert.deepEqual(render(null).saves, []);
  console.log('PASS: stable favorites list, initial load, duplicate taps, refresh during mutation, rollback, errors/retry, logout and account isolation');
} finally {
  for (const slot of runner.slots) slot?.cleanup?.();
  delete globalThis.__savedItemsTest;
}
