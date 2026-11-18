import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)['default'],
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const admin = createClient(Deno.env.get('SUPABASE_URL'), JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS'))!)['default'];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const targetId = typeof body.userId === 'string' ? body.userId : '';
    if (!targetId || targetId === user.id) {
      return new Response(JSON.stringify({ error: 'A user to block is required.' }), { status: 400, headers: corsHeaders });
    }

    const { data: target } = await supabase.from('profiles').select('display_name, email').eq('id', targetId).single();
    const targetName = target?.display_name || target?.email || 'User';

    const { data: existing } = await supabase.from('blocks').select('id')
      .eq('blocker_id', user.id).eq('blocked_id', targetId);
    if (!existing?.length) {
      const { error } = await supabase.from('blocks').insert({
        blocker_id: user.id, blocked_id: targetId, blocked_name: targetName,
      });
      if (error) throw error;
    }

    const { error: clearErr } = await supabase.from('chat_clears').insert({
      user_id: user.id, other_id: targetId, cleared_at: new Date().toISOString(),
    });
    if (clearErr) throw clearErr;

    const { data: mine } = await admin.from('follows').select('id')
      .eq('follower_id', user.id).eq('followee_id', targetId);
    const { data: theirs } = await admin.from('follows').select('id')
      .eq('follower_id', targetId).eq('followee_id', user.id);
    const allIds = [...(mine || []), ...(theirs || [])].map((f) => f.id);
    if (allIds.length) await admin.from('follows').delete().in('id', allIds);

    return new Response(JSON.stringify({ ok: true, blocked: targetId, removedFollows: allIds.length }), { headers: corsHeaders });
  } catch (error) {
    console.error('blockUser failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
