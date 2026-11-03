import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Render the real editor/card with hook slots and a deferred client, so tests
// exercise the archive controls without changing a real listing.
let current;
const updates = [];
let complete;
const runtime = {
  jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
  useState(initial) {
    const runner = current; const slot = runner.index++;
    if (!(slot in runner.slots)) runner.slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [runner.slots[slot], value => { runner.slots[slot] = typeof value === 'function' ? value(runner.slots[slot]) : value; }];
  },
  useRef(initial) { const runner = current; const slot = runner.index++; return runner.slots[slot] ?? (runner.slots[slot] = { current: initial }); },
  supabase: { from(table) {
    assert.equal(table, 'items');
    const request = { filters: {} };
    return {
      update(payload) { request.payload = payload; updates.push(request); return this; },
      eq(key, value) { request.filters[key] = value; return this; }, select() { return this; },
      single() { return new Promise(resolve => { complete = resolve; }); },
    };
  } },
  Dialog: new Proxy({}, { get: (_, key) => `Dialog.${String(key)}` }),
  AlertDialog: new Proxy({}, { get: (_, key) => `AlertDialog.${String(key)}` }),
  PRODUCT_BRANDS: [], PRODUCT_GENDERS: [], PRODUCT_GENDER_LABELS: {}, CONDITION_LABELS: {},
  PRODUCT_CATEGORIES: { shirts: { label: 'Shirts', subcategories: [] } },
  normalizeTags: tags => tags, formatPrice: price => String(price), useLongPress: () => ({}),
};
globalThis.__archiveUI = runtime;
async function component(path) {
  let code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replace(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];?/g, (_, names) => {
    if (names.trim().startsWith('{')) return names.replace(/[{}]/g, '').split(',').map(name => {
      const [original, local] = name.trim().split(/\s+as\s+/);
      return `const ${local || original}=globalThis.__archiveUI[${JSON.stringify(original)}]||(()=>null);`;
    }).join('\n');
    const name = names.trim().replace(/^\*\s+as\s+/, '');
    return `const ${name}=globalThis.__archiveUI[${JSON.stringify(name)}]||(()=>null);`;
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
}
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : node?.props?.children ? text(node.props.children) : '';
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  if (node.props?.open === false) return null;
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
  return null;
};
const flush = () => new Promise(resolve => setImmediate(resolve));
try {
  const Editor = await component('../src/components/EditItemSheet.jsx');
  const Card = await component('../src/components/ItemCard.jsx');
  const item = { id: 'item', created_by_id: 'owner', title: 'Original title', price: 10, is_archived: false };
  const saved = [];
  const runner = { slots: [], index: 0 };
  const render = (value = item, userId = 'owner') => {
    current = runner; runner.index = 0;
    return Editor({ item: value, userId, onClose() {}, onSaved: updated => saved.push(updated) });
  };
  const button = (tree, label) => find(tree, node => node.type === 'button' && text(node).trim() === label);
  button(render(), 'Archive item').props.onClick();
  assert.equal(updates.length, 0, 'Opening confirmation must not archive the item');
  let tree = render();
  const dialog = find(tree, node => node.type === 'AlertDialog.Root' && node.props.open);
  assert(text(dialog).includes('hides this item from other users'));
  assert(text(dialog).includes('unarchive it whenever you want'));
  dialog.props.onOpenChange(false);
  assert.equal(updates.length, 0);
  button(render(), 'Archive item').props.onClick();
  tree = render();
  const warning = find(tree, node => node.type === 'AlertDialog.Root' && node.props.open);
  const confirm = button(warning, 'Archive item');
  confirm.props.onClick(); confirm.props.onClick();
  assert.equal(updates.length, 1, 'Repeated confirmation must submit once');
  assert.deepEqual(updates[0].payload, { is_archived: true });
  assert.deepEqual(updates[0].filters, { id: 'item', created_by_id: 'owner' });
  const archived = { ...item, is_archived: true };
  complete({ data: archived }); await flush();
  assert.equal(saved[0].is_archived, true);
  current = { slots: [], index: 0 };
  const archivedCard = Card({ item: archived, onToggleSave() {} });
  assert(find(archivedCard, node => node.type === 'span' && text(node).trim() === 'archived'));
  assert(!find(archivedCard, node => node.type === 'button' && node.props['aria-label'] === 'Save for later'));

  runner.slots = [];
  button(render(archived), 'Unarchive item').props.onClick();
  assert.deepEqual(updates.at(-1).payload, { is_archived: false });
  complete({ data: item }); await flush();
  assert.equal(saved.at(-1).is_archived, false);
  current = { slots: [], index: 0 };
  const publicCard = Card({ item, onToggleSave() {} });
  assert(find(publicCard, node => node.type === 'button' && node.props['aria-label'] === 'Save for later'));
  console.log('PASS: archive warning/cancel, owner-scoped update, repeated-click protection, archived badge replacing favorite, and unarchive');
} finally { delete globalThis.__archiveUI; }
