import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeRequest } from '../_shared/stripe.ts';

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

    if (order.stripe_payment_intent_id) {
      const intent = await stripeRequest(`payment_intents/${order.stripe_payment_intent_id}`, undefined, 'GET');
      if (intent.status === 'succeeded') {
        return new Response(JSON.stringify({ error: 'Payment already completed; this order cannot be cancelled here.' }), { status: 409, headers: corsHeaders });
      }
      if (!['canceled', 'succeeded'].includes(intent.status)) {
        await stripeRequest(`payment_intents/${order.stripe_payment_intent_id}/cancel`);
      }
    }
    if (order.stripe_session_id) {
      const session = await stripeRequest(`checkout/sessions/${order.stripe_session_id}`, undefined, 'GET').catch(() => null);
      if (session?.status === 'open') await stripeRequest(`checkout/sessions/${order.stripe_session_id}/expire`);
      if (session?.payment_status === 'paid') {
        return new Response(JSON.stringify({ error: 'Payment already completed; this order cannot be cancelled here.' }), { status: 409, headers: corsHeaders });
      }
    }

    const { error } = await admin.from('orders').delete().eq('id', order.id).eq('status', 'awaiting_payment');
    if (error) throw error;

    console.log('unpaid order removed', { orderId: order.id });
    return new Response(JSON.stringify({ orderId: order.id, removed: true }), { headers: corsHeaders });
  } catch (error) {
    console.error('cancelOrder failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not cancel the order.' }), { status: 500, headers: corsHeaders });
  }
});
