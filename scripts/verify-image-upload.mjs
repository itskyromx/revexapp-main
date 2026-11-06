import assert from 'node:assert/strict';
import { validateImageUpload, prepareImageUpload, MAX_IMAGE_BYTES } from '../src/lib/imageUpload.js';

const file = { type: 'image/jpeg', size: MAX_IMAGE_BYTES };
let decoded = 0, closed = 0;
let dimensions = { width: 4096, height: 4096 };
globalThis.createImageBitmap = async () => { decoded++; return { ...dimensions, close() { closed++; } }; };
await validateImageUpload(file);
assert.equal(closed, 1);
await assert.rejects(validateImageUpload({ ...file, size: MAX_IMAGE_BYTES + 1 }), /5 MB/);
await assert.rejects(validateImageUpload({ ...file, size: 0 }), /non-empty/);
await assert.rejects(validateImageUpload({ ...file, type: 'image/svg+xml' }), /JPEG/);
assert.equal(decoded, 1, 'Invalid file size/type must be rejected before decoding');
for (const size of [{ width: 4097, height: 100 }, { width: 100, height: 4097 }]) {
  dimensions = size;
  await assert.rejects(validateImageUpload(file), /4096/);
}
assert.equal(closed, 3, 'Decoded images must be released even when dimensions exceed limits');
globalThis.createImageBitmap = async () => { throw new Error('corrupt image'); };
await assert.rejects(validateImageUpload(file), /could not be opened/);
delete globalThis.createImageBitmap;
let revoked = 0;
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => { revoked++; };
globalThis.Image = class {
  naturalWidth = 4096;
  naturalHeight = 3000;
  set src(_value) { queueMicrotask(() => this.onload()); }
};
await validateImageUpload(file);
assert.equal(revoked, 1);
URL.createObjectURL = originalCreate;
URL.revokeObjectURL = originalRevoke;
delete globalThis.Image;
globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });
globalThis.document = { createElement: () => ({
  width: 0, height: 0,
  getContext: () => ({ fillRect() {}, drawImage() {} }),
  toBlob: callback => callback(new Blob([new Uint8Array(20)], { type: 'image/jpeg' })),
}) };
const converted = await prepareImageUpload(new File([new Uint8Array(20)], 'photo.avif', { type: 'image/avif' }));
assert.equal(converted.type, 'image/jpeg');
assert(converted.size <= MAX_IMAGE_BYTES);
delete globalThis.document;
delete globalThis.createImageBitmap;
console.log('PASS: byte/dimension boundaries, supported types, corrupt files, bitmap release, browser fallback and object URL cleanup');
