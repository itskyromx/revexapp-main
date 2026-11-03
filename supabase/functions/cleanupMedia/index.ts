import { createClient } from 'jsr:@supabase/supabase-js@2';
import { duplicateGroups, orphanCandidates, referencePaths, mediaPath } from './media.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const token = req.headers.get('x-media-cleanup-token');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return new Response('Unauthorized', { status: 401 });
  const projectUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(projectUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: allowed, error: authError } = await admin.rpc('authorize_media_cleanup', { p_token: token });
  if (authError || allowed !== true) return new Response('Unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const apply = body.apply === true;
  const storage = admin.storage.from('media');
  const rpc = async (name: string, args = {}) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw error;
    return data;
  };
  const publicUrl = (path: string) => storage.getPublicUrl(path).data.publicUrl;
  try {
    let snapshot = await rpc('media_cleanup_snapshot');
    const duplicates: { old: string; canonical: string }[] = [];
    let replacements = 0;
    // Metadata is only a prefilter: verify exact SHA-256 of downloaded bytes.
    if (body.maintenance === true) {
      const refs = referencePaths(snapshot.references, projectUrl);
      for (const group of duplicateGroups(snapshot.objects)) {
        group.sort((a, b) => Number(refs.has(b.name)) - Number(refs.has(a.name)) || a.created_at.localeCompare(b.created_at));
        const hashes = new Map<string, string>();
        for (const object of group) {
          const { data: file, error } = await storage.download(object.name);
          if (error || !file) throw error || new Error('Unable to verify duplicate');
          const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
          const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
          const canonical = hashes.get(hash);
          if (!canonical) { hashes.set(hash, object.name); continue; }
          duplicates.push({ old: object.name, canonical });
          if (apply) {
            // Use the original stored URLs (including escaped filenames).
            for (const url of new Set<string>(snapshot.references)) {
              if (mediaPath(url, projectUrl) !== object.name) continue;
              await rpc('replace_duplicate_media', { p_old: url, p_new: publicUrl(canonical) });
              replacements++;
            }
          }
        }
      }
      if (apply) snapshot = await rpc('media_cleanup_snapshot');
    }
    const candidates = orphanCandidates(snapshot, projectUrl);
    let removed = 0, bytes = 0;
    const errors: string[] = [];
    if (apply) {
      for (const object of candidates.slice(0, 500)) {
        // Recheck ALL references immediately before deleting the actual file.
        const fresh = await rpc('media_cleanup_snapshot');
        if (!orphanCandidates(fresh, projectUrl).some(o => o.name === object.name)) continue;
        const { error } = await storage.remove([object.name]);
        if (error) { errors.push(`${object.name}: ${error.message}`); continue; }
        removed++;
        bytes += Number(object.metadata?.size || 0);
      }
      const fresh = await rpc('media_cleanup_snapshot');
      const present = new Set(fresh.objects.map((o: any) => o.name));
      const refs = referencePaths(fresh.references, projectUrl);
      // References still used elsewhere are safe; future deletes enqueue again.
      const done = fresh.pending.filter((url: string) => {
        const path = mediaPath(url, projectUrl);
        return !path || !present.has(path) || refs.has(path);
      });
      if (done.length) await rpc('acknowledge_media_cleanup', { p_urls: done });
    }
    return Response.json({ apply, candidates: candidates.map(o => o.name), duplicates, replacements, removed, bytes, errors });
  } catch (error) {
    console.error('Media cleanup failed:', error);
    return Response.json({ error: 'Media cleanup failed; queued files will be retried.' }, { status: 500 });
  }
});
