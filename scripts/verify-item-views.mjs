import assert from 'node:assert/strict';
import fs from 'node:fs';
import { observeItemView } from '../src/lib/itemViewTracker.js';

// Exercise browser visibility and dwell time without wall-clock delays.
const originals = Object.fromEntries(['document', 'IntersectionObserver', 'setTimeout', 'clearTimeout', 'localStorage']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const listeners = new Set();
const timers = new Map();
const observers = [];
let now = 0;
let timerId = 0;
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (_, callback) => listeners.add(callback),
  removeEventListener: (_, callback) => listeners.delete(callback),
};
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe(element) { this.element = element; }
  disconnect() { this.disconnected = true; }
};
globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
const tick = async milliseconds => {
  now += milliseconds;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  await Promise.resolve();
  await Promise.resolve();
};
const show = (observer, ratio) => observer.callback([{ target: observer.element, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
const setTabVisibility = value => { document.visibilityState = value; listeners.forEach(callback => callback()); };

try {
  let views = 0;
  const dispose = observeItemView({}, () => { views += 1; });
  const card = observers.at(-1);
  await tick(5000);
  assert.equal(views, 0, 'Preloaded/offscreen cards must not count');
  show(card, 0.59);
  await tick(2000);
  assert.equal(views, 0, 'Mostly hidden cards must not count');
  show(card, 0.8);
  await tick(999);
  assert.equal(views, 0);
  show(card, 0);
  await tick(1000);
  assert.equal(views, 0, 'Scrolling away must cancel the dwell timer');
  show(card, 0.8);
  await tick(500);
  setTabVisibility('hidden');
  await tick(5000);
  assert.equal(views, 0, 'Background tabs must not count');
  setTabVisibility('visible');
  await tick(999);
  assert.equal(views, 0, 'Returning to a tab requires a new full dwell');
  await tick(1);
  assert.equal(views, 1);
  show(card, 0);
  show(card, 1);
  await tick(2000);
  assert.equal(views, 1, 'Repeated intersections must not count twice');
  dispose();
  const stop = observeItemView({}, () => { views += 1; });
  show(observers.at(-1), 1);
  stop();
  await tick(2000);
  assert.equal(views, 1, 'Unmount must cancel pending impressions');
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);

  // Run the real deduplication code with a deferred RPC and consent-aware store.
  let consent = false;
  let stored = '[]';
  let storageReads = 0;
  let storageWrites = 0;
  const requests = [];
  globalThis.localStorage = {
    getItem() { storageReads += 1; assert(consent, 'No optional reads before consent'); return stored; },
    setItem(_, value) { storageWrites += 1; assert(consent, 'No optional writes after consent withdrawal'); stored = value; },
  };
  globalThis.__viewTest = {
    supabase: { rpc(name, args) { assert.equal(name, 'record_item_view'); return new Promise(resolve => requests.push({ id: args.p_item_id, resolve })); } },
    hasCookieConsent: () => consent,
  };
  const source = fs.readFileSync(new URL('../src/lib/itemStats.js', import.meta.url), 'utf8')
    .replace(/^import .*supabaseClient.*\r?\n/m, 'const { supabase } = globalThis.__viewTest;\n')
    .replace(/^import .*cookieConsent.*\r?\n/m, 'const { hasCookieConsent } = globalThis.__viewTest;\n');
  const load = suffix => import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${suffix}`).toString('base64')}`);
  const { recordItemView } = await load('initial page');
  const first = recordItemView('guest-item');
  assert.equal(await recordItemView('guest-item'), null);
  assert.equal(requests.length, 1, 'Feed/detail concurrent calls must share the reservation');
  requests.shift().resolve({ data: { id: 'guest-item', view_count: 1 } });
  await first;
  assert.equal(await recordItemView('guest-item'), null);
  assert.equal(storageReads + storageWrites, 0, 'Guest deduplication must work without optional storage');

  consent = true;
  const a = recordItemView('a');
  const b = recordItemView('b');
  requests.shift().resolve({ data: { id: 'a' } }); await a;
  requests.shift().resolve({ data: { id: 'b' } }); await b;
  assert.deepEqual(JSON.parse(stored).sort(), ['a', 'b'], 'Concurrent responses must preserve both stored IDs');
  const reloaded = await load('new page');
  assert.equal(await reloaded.recordItemView('a'), null, 'Consented deduplication must survive reloads');
  const pending = recordItemView('consent-withdrawn');
  const writesBefore = storageWrites;
  consent = false;
  requests.shift().resolve({ data: { id: 'consent-withdrawn' } }); await pending;
  assert.equal(storageWrites, writesBefore);
  delete globalThis.__viewTest;
  console.log('PASS: visible dwell, scroll/background cancellation, unmount, guest deduplication, concurrent storage updates and consent withdrawal');
} finally {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
