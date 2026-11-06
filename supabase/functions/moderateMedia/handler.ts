import { FASHION_POLICY, POLICY_VERSION, MAX_BYTES, MIME_EXT, REASONS, moderationResult, visionResult, rejectionMessage, hasAnimation } from './policy.ts';

// Dependencies are injected so auth, provider failures and upload ordering can be tested.
export function createModeratedUploadHandler(deps: any) {
  const { createClient, env, imageSize, corsHeaders, fetch: fetcher = fetch } = deps;
  const reply = (body: unknown, status=200) => Response.json(body,{status,headers:corsHeaders});
  return async (req: Request): Promise<Response> => {
    if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
    if (req.method!=='POST') return reply({error:'Method not allowed'},405);
    let admin: any, checkId: string | null=null, uploadedPath: string | null=null;
    try {
      const project=env('SUPABASE_URL');
      const client=createClient(project,env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
      const {data:{user},error:authError}=await client.auth.getUser();
      if (authError || !user) return reply({error:'Please sign in to upload a photo.'},401);
      const key=env('OPENAI_API_KEY');
      if (!key) return reply({code:'moderation_unavailable',error:'Photo safety checks are temporarily unavailable. Please try again later.'},503);
      if (Number(req.headers.get('content-length'))>MAX_BYTES+65536) return reply({error:'Each image must be no larger than 5 MB.'},413);
      // Bound the actual request too: content-length is not trusted.
      const reader=req.body?.getReader();
      if (!reader) return reply({error:'Choose an image.'},400);
      const chunks: Uint8Array[]=[]; let size=0;
      while (true) {
        const {done,value}=await reader.read(); if(done) break;
        size+=value.byteLength;
        if (size>MAX_BYTES+65536) { await reader.cancel(); return reply({error:'Each image must be no larger than 5 MB.'},413); }
        chunks.push(value);
      }
      const form=await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
      const file=form.get('file'); const folder=form.get('folder');
      if (!(file instanceof File) || !Object.hasOwn(MIME_EXT,file.type) || !file.size || file.size>MAX_BYTES || typeof folder!=='string' || !['items','avatars','item-frames','uploads'].includes(folder)) {
        return reply({error:'Choose a JPEG, PNG or WebP image up to 5 MB. AVIF photos must be converted before upload.'},400);
      }
      if (form.get('policyVersion')!==POLICY_VERSION) return reply({error:'Refresh the page to review the updated photo rules.'},409);
      const bytes=new Uint8Array(await file.arrayBuffer());
      let dimensions;
      try { dimensions=imageSize(bytes); } catch { return reply({error:'This file is not a readable image.'},400); }
      const actualType=dimensions.type==='jpg' ? 'image/jpeg' : `image/${dimensions.type}`;
      if (actualType!==file.type || !dimensions.width || !dimensions.height || dimensions.width>4096 || dimensions.height>4096 || hasAnimation(bytes,file.type)) {
        return reply({error:'Choose a still image no larger than 4096 × 4096 pixels, with the correct file format.'},400);
      }
      admin=createClient(project,env('SUPABASE_SERVICE_ROLE_KEY'));
      const rpc=async (name:string,args:any) => {
        const {data,error}=await admin.rpc(name,args); if(error) throw new Error('Moderation database unavailable'); return data;
      };
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      const reservation=await rpc('reserve_media_moderation',{p_owner:user.id,p_hash:hash,p_policy:POLICY_VERSION});
      if (reservation.cached_path) return reply({file_url:admin.storage.from('media').getPublicUrl(reservation.cached_path).data.publicUrl});
      if (reservation.rejected) return reply({code:'photo_rejected',error:rejectionMessage(reservation.reason)},422);
      if (reservation.rate_limited) return reply({code:'rate_limited',error:'You have uploaded too many photos recently. Please try again later.'},429);
      if (reservation.busy) return reply({error:'This photo is already being checked. Please wait a moment and try again.'},409);
      if (!reservation.id) throw new Error('Missing moderation reservation');
      checkId=reservation.id;
      // Encode in bounded chunks instead of spreading a multi-megabyte array.
      let binary=''; for (let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      const dataUrl=`data:${file.type};base64,${btoa(binary)}`;
      const openai=async (endpoint:string,body:any) => {
        const response=await fetcher(`https://api.openai.com/v1/${endpoint}`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify(body),signal:AbortSignal.timeout(25000),
        });
        if(!response.ok) throw new Error(`Photo reviewer unavailable (${response.status})`);
        return response.json();
      };
      const screening=moderationResult(await openai('moderations',{
        model:'omni-moderation-latest',input:[{type:'image_url',image_url:{url:dataUrl}}],
      }));
      let reason=screening.reason;
      if (!screening.blocked) {
        reason=visionResult(await openai('chat/completions',{
          model:'gpt-4.1-mini-2025-04-14',store:false,temperature:0,max_completion_tokens:150,
          messages:[{role:'system',content:FASHION_POLICY},{role:'user',content:[
            {type:'text',text:'Classify this image under the Revex photo policy.'},
            {type:'image_url',image_url:{url:dataUrl,detail:'high'}},
          ]}],
          response_format:{type:'json_schema',json_schema:{name:'revex_photo_safety',strict:true,schema:{
            type:'object',properties:{reason:{type:'string',enum:REASONS}},required:['reason'],additionalProperties:false,
          }}},
        }));
      }
      if (reason!=='safe') {
        await rpc('finish_media_moderation',{p_id:checkId,p_status:reason==='uncertain'?'error':'rejected',p_reason:reason});
        checkId=null;
        return reply({code:'photo_rejected',error:rejectionMessage(reason)},422);
      }
      const path=`${folder}/${user.id}/${crypto.randomUUID()}.${MIME_EXT[file.type]}`;
      const {error:uploadError}=await admin.storage.from('media').upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if (uploadError) throw new Error('Photo storage unavailable');
      uploadedPath=path;
      await rpc('finish_media_moderation',{p_id:checkId,p_status:'approved',p_path:path});
      checkId=null; uploadedPath=null;
      return reply({file_url:admin.storage.from('media').getPublicUrl(path).data.publicUrl});
    } catch {
      // Never log image bytes, data URLs, credentials or raw model responses.
      if (uploadedPath && admin) await admin.storage.from('media').remove([uploadedPath]).catch(()=>{});
      if (checkId && admin) await admin.rpc('finish_media_moderation',{p_id:checkId,p_status:'error',p_reason:'service_failure'}).catch(()=>{});
      return reply({code:'moderation_unavailable',error:'The photo could not be safely checked or saved. Please try again.'},503);
    }
  };
}
