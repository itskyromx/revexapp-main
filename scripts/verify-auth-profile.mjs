import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual profile loader with network/auth failures.
const clientSource = fs.readFileSync('src/api/supabaseClient.js', 'utf8');
const loaderSource = clientSource.slice(clientSource.indexOf('export async function getCurrentUserProfile'), clientSource.indexOf('export async function callFunction')).replace('export ', '');
const load = new Function('supabase', `${loaderSource}; return getCurrentUserProfile;`);
let profileResult;
let authResult = { data: { user: { id: 'alice' } } };
const query = { select() { return this; }, eq() { return this; }, async single() { return profileResult; } };
const client = { auth: { getUser: async () => authResult }, from: () => query };
profileResult = { data: null, error: new Error('network failure') };
await assert.rejects(load(client)(), /network failure/);
profileResult = { data: { id: 'alice', display_name: 'alice' }, error: null };
assert.equal((await load(client)()).display_name, 'alice');
authResult = { data: { user: null }, error: new Error('auth unavailable') };
await assert.rejects(load(client)(), /auth unavailable/);

// Run the real provider with controllable requests and React hook storage.
let slots = [], cursor = 0, effect, listener, value;
const pending = [];
const React = {
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], next => { slots[i] = next; }];
  },
  useRef(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = { current: initial };
    return slots[i];
  },
  useEffect(fn) { effect = fn; },
  createElement(_type, props) { value = props.value; return null; },
};
const module = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/lib/AuthContext.jsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
vm.runInNewContext(source, {
  module, exports: module.exports, console: { error() {} }, setTimeout, clearTimeout,
  require(name) {
    if (name === 'react') return React;
    if (name.includes('authContextValue')) return { AuthContext: { Provider: 'provider' } };
    return {
      getCurrentUserProfile: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
      supabase: { auth: { onAuthStateChange(cb) { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; } } },
    };
  },
});
const render = () => { cursor = 0; module.exports.AuthProvider({ children: null }); return value; };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
render();
const cleanup = effect();
pending.shift().resolve({ id: 'alice', display_name: 'alice' });
await tick();
assert.equal(render().user.display_name, 'alice');
listener('TOKEN_REFRESHED', { user: { id: 'alice' } });
await tick();
pending.shift().reject(new Error('temporary profile failure'));
await tick();
assert.equal(render().user.display_name, 'alice');
assert.equal(value.isAuthenticated, true);
listener('SIGNED_IN', { user: { id: 'bob' } });
assert.equal(render().user, null);
assert.equal(value.isLoadingAuth, true);
await tick();
const stale = pending.shift();
listener('SIGNED_OUT', null);
stale.resolve({ id: 'bob', display_name: 'bob' });
await tick();
assert.equal(render().user, null);
assert.equal(value.isAuthenticated, false);
cleanup();
console.log('PASS: profile/auth failures, refresh preserves loaded profile, account switch isolation, stale response after logout');
