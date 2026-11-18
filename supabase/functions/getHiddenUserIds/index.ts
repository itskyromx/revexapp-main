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
    if (!user) return new Response(JSON.stringify({ ids: [] }), { headers: corsHeaders });

    const { data: hidden } = await supabase.from('profiles').select('id').eq('hide_from_search', true);
    const ids = (hidden || []).map((u) => u.id).filter((id) => id && id !== user.id);

    return new Response(JSON.stringify({ ids }), { headers: corsHeaders });
  } catch (error) {
    console.error('getHiddenUserIds failed:', error);
    return new Response(JSON.stringify({ ids: [] }), { headers: corsHeaders });
  }
});
