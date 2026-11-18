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
    const admin = createClient(Deno.env.get('SUPABASE_URL'), JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default']);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    if (!orderId) return new Response(JSON.stringify({ error: 'Missing order' }), { status: 400, headers: corsHeaders });

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the buyer can cancel this order' }), { status: 403, headers: corsHeaders });
    }

    if (order.status === 'cancelled') {
      return new Response(JSON.stringify({ order, alreadyCancelled: true }), { headers: corsHeaders });
    }
    if (order.status !== 'awaiting_payment') {
      return new Response(JSON.stringify({ error: 'This order can no longer be cancelled' }), { status: 400, headers: corsHeaders });
    }

    const { data: updated, error } = await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id).select().single();
    if (error) throw error;

    if (order.item_id) {
      const { data: item } = await admin.from('items').select('status').eq('id', order.item_id).single();
      if (item && item.status !== 'sold') {
        await admin.from('items').update({ status: 'available' }).eq('id', order.item_id);
      }
    }

    console.log('order cancelled', { orderId: order.id });
    return new Response(JSON.stringify({ order: updated }), { headers: corsHeaders });
  } catch (error) {
    console.error('cancelOrder failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not cancel the order.' }), { status: 500, headers: corsHeaders });
  }
});
