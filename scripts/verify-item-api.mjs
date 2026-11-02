import assert from 'node:assert/strict';
import { loadEnv } from 'vite';
const env=loadEnv('production',process.cwd(),'VITE_');
const base=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_ANON_KEY;
assert(base && key, 'Missing public Supabase environment');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
const preflight=await fetch(`${base}/functions/v1/getFeed`,{method:'OPTIONS',headers:{Origin:'https://revexxapp.com','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'}});
assert(preflight.ok);
assert(preflight.headers.get('Access-Control-Allow-Methods')?.includes('POST'),'Cross-origin POST must be allowed');
const feed=await fetch(`${base}/functions/v1/getFeed`,{method:'POST',headers,body:JSON.stringify({mode:'fyp'})});
assert.equal(feed.status,200);
const data=await feed.json();
assert(Array.isArray(data.items) && data.items.length>0,'Feed must return canonical items');
assert(Array.isArray(data.posts),'Legacy clients must retain feed access');
assert.equal(new Set(data.items.map(item=>item.id)).size,data.items.length);
for(const item of data.items){assert(item.title);assert(Array.isArray(item.image_urls));assert(!('boost_payment_ids' in item));}
const rest=await fetch(`${base}/rest/v1/items?select=id,title,image_urls,like_count,bookmark_count&limit=2`,{headers});
assert.equal(rest.status,200);assert((await rest.json()).length>0);
for(const name of ['boostItem','deleteItem']){
 const response=await fetch(`${base}/functions/v1/${name}`,{method:'POST',headers,body:JSON.stringify({})});
 assert.equal(response.status,401,`${name} must reject anonymous calls`);
}
console.log(`PASS: live feed (${data.items.length} unique items), canonical REST fields, legacy feed response, anonymous boost/delete denied`);
