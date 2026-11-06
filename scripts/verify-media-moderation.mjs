import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const load = (file, dependencies={}) => {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>dependencies[name],Response,Request,FormData,File,Blob,URL,Uint8Array,DataView,TextDecoder,Set,Map,crypto,btoa,AbortSignal,fetch,console});
  return module.exports;
};
const policy=load('supabase/functions/moderateMedia/policy.ts');
const { createModeratedUploadHandler }=load('supabase/functions/moderateMedia/handler.ts',{'./policy.ts':policy});
const scores={sexual:0.02,'violence/graphic':0.01,'self-harm':0.01};
const screen=(values={})=>({results:[{category_scores:{...scores,...values},categories:{sexual:false,'violence/graphic':false,'self-harm':false}}]});
assert.throws(()=>policy.moderationResult({}),/Invalid/);
assert.equal(policy.moderationResult(screen()).blocked,false);
assert.equal(policy.moderationResult(screen({sexual:0.98})).blocked,true);
assert.equal(policy.moderationResult(screen({'violence/graphic':0.8})).reason,'graphic_violence');
const vision=reason=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reason})}}]});
assert.equal(policy.visionResult(vision('safe')),'safe');
assert.throws(()=>policy.visionResult(vision('unknown')),/Invalid/);
assert.throws(()=>policy.visionResult({choices:[{finish_reason:'length',message:{}}]}),/Incomplete/);
const apng=new Uint8Array(20); apng.set(new TextEncoder().encode('acTL'),12);
assert.equal(policy.hasAnimation(apng,'image/png'),true);

async function run({reason='safe',screening=screen(),providerStatus=200,auth=true,key=true,reservation={id:'check-id'},finishFails=false,dimensions={type:'png',width:800,height:600},policyVersion=policy.POLICY_VERSION,fileSize=16}={}) {
  const events=[]; let providerCalls=0;
  const storage={
    getPublicUrl:path=>({data:{publicUrl:`https://test.supabase.co/storage/v1/object/public/media/${path}`}}),
    async upload() { events.push('upload'); return {}; },
    async remove() { events.push('remove'); return {}; },
  };
  const admin={storage:{from:()=>storage},async rpc(name,args) {
    events.push(name==='finish_media_moderation'?`finish:${args.p_status}`:name);
    if(name==='reserve_media_moderation') return {data:reservation};
    if(finishFails && args.p_status==='approved') return {error:{message:'db failure'}};
    return {};
  }};
  const handler=createModeratedUploadHandler({
    corsHeaders:{},env:name=>name==='SUPABASE_ANON_KEY'?'anon':name==='OPENAI_API_KEY'?(key?'key':null):'test',
    imageSize:()=>dimensions,
    createClient:(_url,k)=>k==='anon'?{auth:{getUser:async()=>({data:{user:auth?{id:'user-id'}:null}})}}:admin,
    fetch:async(url,options)=>{
      events.push('provider'); providerCalls++;
      assert(!options.body.includes('private-filename'),'Filenames must not go to the provider');
      if(providerStatus!==200) return new Response('{}',{status:providerStatus});
      return Response.json(url.endsWith('/moderations')?screening:vision(reason));
    },
  });
  const form=new FormData();
  form.append('file',new File([new Uint8Array(fileSize)],'private-filename.png',{type:'image/png'}));
  form.append('folder','items'); form.append('policyVersion',policyVersion);
  const response=await handler(new Request('https://edge.test',{method:'POST',body:form}));
  return {status:response.status,body:await response.json(),events,providerCalls};
}
let result=await run();
assert.equal(result.status,200);
assert(result.events.indexOf('upload')>result.events.lastIndexOf('provider'));
assert(result.events.includes('finish:approved'));
for(const reason of ['explicit_nudity','sexual_content','sexualized_minor','graphic_violence','hate_symbols','uncertain']) {
  result=await run({reason});
  assert.equal(result.status,422);
  assert(!result.events.includes('upload'),`${reason} must never reach public storage`);
}
for(const options of [{providerStatus:429},{providerStatus:500},{screening:{}},{key:false},{finishFails:true}]) {
  result=await run(options);
  assert.equal(result.status,503);
  if(options.finishFails) assert(result.events.includes('remove'),'Roll back public file when approval registration fails');
  else assert(!result.events.includes('upload'));
}
assert.equal((await run({auth:false})).status,401);
assert.equal((await run({policyVersion:'old'})).status,409);
assert.equal((await run({reservation:{rate_limited:true}})).status,429);
assert.equal((await run({dimensions:{type:'png',width:5000,height:100}})).status,400);
assert.equal((await run({dimensions:{type:'jpg',width:100,height:100}})).status,400);
result=await run({reservation:{cached_path:'items/user-id/cached.png'}});
assert.equal(result.providerCalls,0);
assert.equal(result.status,200);
console.log('PASS: fashion policy, rejection reasons, malformed/refused provider responses, fail-closed behavior, auth, quotas, cache, server dimensions/types, public upload ordering and rollback');
