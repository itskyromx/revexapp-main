import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

export async function handleFeed(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await client.auth.getUser();
    const body = await req.json().catch(() => ({}));
    const cursor = Math.max(0, Math.trunc(Number(body.cursor) || 0));
    const [{ data: profile }, { data: follows }, { data: blocks }] = user ? await Promise.all([
      client.from('profiles').select('style_preferences,favorite_brands').eq('id', user.id).maybeSingle(),
      client.from('follows').select('followee_id').eq('follower_id', user.id),
      client.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    ]) : [{ data: null }, { data: [] }, { data: [] }];
    const following = new Set((follows || []).map(f => f.followee_id));
    const hidden = new Set((blocks || []).flatMap(b => [b.blocker_id, b.blocked_id]).filter(id => id !== user?.id));
    let query = client.from('items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(200);
    if (body.mode === 'friends') {
      if (following.size) query = query.in('created_by_id', [...following]);
      else return Response.json({ items: [], posts: [], nextCursor: null, hasMore: false }, { headers: corsHeaders });
    }
    const { data, error } = await query;
    if (error) throw error;
    const score = (item: Record<string, any>) => {
      const engagement = (item.like_count || 0) * 4 + (item.share_count || 0) * 5 + (item.bookmark_count || 0) * 3;
      const hours = Math.max(0, (Date.now() - new Date(item.created_at).getTime()) / 36e5);
      const tags = (item.tags || []).filter((tag: string) => profile?.style_preferences?.includes(tag)).length;
      const brand = profile?.favorite_brands?.some((b: string) => b.toLowerCase() === item.brand?.toLowerCase()) ? 1.5 : 1;
      return (engagement + 8) * Math.max(0.05, Math.pow(0.5, hours / 30)) * (1 + tags * 0.35) * brand * (following.has(item.created_by_id) ? 1.4 : 1);
    };
    const ranked = (data || []).filter(item => !hidden.has(item.created_by_id)).sort((a, b) => {
      const boost = (item: typeof a) => new Date(item.boost_expires_at || 0).getTime() > Date.now() ? 1 : 0;
      return boost(b) - boost(a) || score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const page = ranked.slice(cursor, cursor + 10);
    const hasMore = cursor + 10 < ranked.length;
    // Only an API adapter for already-open versions of the application.
    const legacy = page.map(item => ({ ...item, id: item.post_id || item.id, haul_title: item.title,
      caption: item.description, creator_name: item.seller_name, creator_avatar: item.seller_avatar, item_ids: [item.id] }));
    return Response.json({ items: page, posts: legacy, nextCursor: hasMore ? cursor + 10 : null, hasMore }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not load items' }, { status: 500, headers: corsHeaders });
  }
}
Deno.serve(handleFeed);
