import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { generateDropOffCode } from '../_shared/pricing.ts';
import { stripeRequest } from '../_shared/stripe.ts';
import { createNotification } from '../_shared/notifications.ts';

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
    const orderId = body?.orderId;
    if (!orderId) return new Response(JSON.stringify({ error: 'Missing order' }), { status: 400, headers: corsHeaders });

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (order.buyer_id !== user.id && profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }
    if (order.status !== 'awaiting_payment') return new Response(JSON.stringify({ order }), { headers: corsHeaders });
    let paymentIntentId = order.stripe_payment_intent_id;
    if (!paymentIntentId && order.stripe_session_id) {
      const legacySession = await stripeRequest(`checkout/sessions/${order.stripe_session_id}`, undefined, 'GET');
      if (legacySession?.metadata?.order_id !== order.id) {
        return new Response(JSON.stringify({ error: 'Checkout session does not match this order.' }), { status: 403, headers: corsHeaders });
      }
      if (legacySession?.payment_status !== 'paid') return new Response(JSON.stringify({ order, pending: true }), { headers: corsHeaders });
      paymentIntentId = typeof legacySession.payment_intent === 'string' ? legacySession.payment_intent : '';
    }
    if (!paymentIntentId) return new Response(JSON.stringify({ order, pending: true }), { headers: corsHeaders });

    const paymentIntent = await stripeRequest(`payment_intents/${paymentIntentId}`, undefined, 'GET');
    if (paymentIntent?.metadata?.order_id !== order.id) {
      return new Response(JSON.stringify({ error: 'Payment does not match this order.' }), { status: 403, headers: corsHeaders });
    }
    if (paymentIntent?.amount !== Math.round(Number(order.total) * 100) || paymentIntent?.currency !== 'eur') {
      return new Response(JSON.stringify({ error: 'Payment amount does not match this order.' }), { status: 409, headers: corsHeaders });
    }
    if (paymentIntent?.status !== 'succeeded') return new Response(JSON.stringify({ order, pending: true }), { headers: corsHeaders });

    const { data: updated, error } = await admin.from('orders').update({
      status: 'paid',
      paid_date: new Date().toISOString(),
      drop_off_code: order.drop_off_code || generateDropOffCode(),
      stripe_payment_intent_id: paymentIntent.id,
    }).eq('id', order.id).eq('status', 'awaiting_payment').select().maybeSingle();
    if (error) throw error;

    if (!updated) {
      const { data: current } = await admin.from('orders').select('*').eq('id', order.id).single();
      return new Response(JSON.stringify({ order: current }), { headers: corsHeaders });
    }

    await admin.from('items').update({ status: 'reserved' }).eq('id', order.item_id);
    if (order.offer_id) {
      await admin.from('offers').update({ status: 'accepted' }).eq('id', order.offer_id);
    }

    await createNotification({
      recipientId: order.seller_id,
      actorId: order.buyer_id,
      actorName: order.buyer_name,
      thumbnail: order.item_image || '',
      type: 'sale',
      title: 'You made a sale',
      body: `${order.buyer_name || 'A buyer'} paid for ${order.item_title}. Open your order to get the drop-off code.`,
      targetType: 'order',
      targetId: order.id,
    });

    return new Response(JSON.stringify({ order: updated }), { headers: corsHeaders });
  } catch (error) {
    console.error('confirmCheckout failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not confirm payment.' }), { status: 500, headers: corsHeaders });
  }
});
