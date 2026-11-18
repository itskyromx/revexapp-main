import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { generateDropOffCode as mintCode } from '../_shared/pricing.ts';

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
    const orderId = body?.orderId;
    if (!orderId) return new Response(JSON.stringify({ error: 'Missing order' }), { status: 400, headers: corsHeaders });

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (order.seller_id !== user.id && profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only the seller can view this code' }), { status: 403, headers: corsHeaders });
    }
    if (order.drop_off_code) {
      return new Response(JSON.stringify({ code: order.drop_off_code }), { headers: corsHeaders });
    }

    const code = mintCode();
    const { error } = await supabase.from('orders').update({ drop_off_code: code }).eq('id', order.id);
    if (error) throw error;

    return new Response(JSON.stringify({ code }), { headers: corsHeaders });
  } catch (error) {
    console.error('generateDropOffCode failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not create the drop-off code.' }), { status: 500, headers: corsHeaders });
  }
});
