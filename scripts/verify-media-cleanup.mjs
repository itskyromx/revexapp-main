import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/cleanupMedia/media.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports, URL, Date, Set, Map });
const { mediaPath, orphanCandidates, duplicateGroups } = module.exports;
const project = 'https://example.supabase.co';
const url = path => `${project}/storage/v1/object/public/media/${path}`;
const now = Date.now();
const object = (name, age = 48, etag = 'same', size = 100) => ({ name,
  created_at: new Date(now - age * 3600000).toISOString(),
  metadata: { mimetype: 'image/jpeg', eTag: etag, size },
});
assert.equal(mediaPath(url('items/photo%20one.jpg'), project), 'items/photo one.jpg');
assert.equal(mediaPath('https://other.example/storage/v1/object/public/media/items/photo.jpg', project), null);
assert.equal(mediaPath(`${project}/storage/v1/object/public/other/item.jpg`, project), null);
const snapshot = {
  references: ['published','archived','draft','order','avatar'].map(url),
  pending: [url('deleted'), url('draft')],
  objects: ['published','archived','draft','order','avatar','orphan'].map(name => object(name))
    .concat([object('upload-in-progress', 0.01), object('deleted', 0.01)]),
};
assert.equal(orphanCandidates(snapshot, project, now).map(o => o.name).sort().join(','), 'deleted,orphan');
snapshot.references.push(url('deleted'));
assert.equal(orphanCandidates(snapshot, project, now).map(o => o.name).join(','), 'orphan');
assert.equal(duplicateGroups([object('a'), object('b'), object('recent', 1), object('different-size',48,'same',101)], now).length, 1);
console.log('PASS: live/archived/draft/order/avatar references protected; upload grace; deleted-item cleanup; URL/bucket isolation; duplicate prefilter');
