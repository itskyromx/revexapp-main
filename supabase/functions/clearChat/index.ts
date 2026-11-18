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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const targetId = typeof body.userId === 'string' ? body.userId : '';
    if (!targetId || targetId === user.id) {
      return new Response(JSON.stringify({ error: 'A conversation to clear is required.' }), { status: 400, headers: corsHeaders });
    }

    const clearedAt = new Date().toISOString();
    const { error } = await supabase.from('chat_clears').insert({
      user_id: user.id, other_id: targetId, cleared_at: clearedAt,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, cleared_at: clearedAt }), { headers: corsHeaders });
  } catch (error) {
    console.error('clearChat failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
