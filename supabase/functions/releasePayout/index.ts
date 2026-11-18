import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sellerPayout } from '../_shared/pricing.ts';
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
      return new Response(JSON.stringify({ error: 'Only the buyer can confirm this order' }), { status: 403, headers: corsHeaders });
    }
    if (order.status === 'completed') return new Response(JSON.stringify({ order }), { headers: corsHeaders });
    if (order.status !== 'paid' && order.status !== 'in_transit') {
      return new Response(JSON.stringify({ error: "This order can't be confirmed yet" }), { status: 400, headers: corsHeaders });
    }

    const { data: seller } = await admin.from('profiles').select('stripe_account_id').eq('id', order.seller_id).single();
    if (!seller?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'The seller has no payout account yet' }), { status: 400, headers: corsHeaders });
    }

    const payout = Math.round(sellerPayout(order.item_price, order.shipping_price) * 100);

    const transfer = await stripeRequest('transfers', {
      amount: String(payout),
      currency: 'eur',
      destination: seller.stripe_account_id,
      transfer_group: order.id,
      'metadata[order_id]': order.id,
    });

    const { data: updated, error } = await admin.from('orders').update({
      status: 'completed',
      completed_date: new Date().toISOString(),
      stripe_transfer_id: transfer.id,
    }).eq('id', order.id).select().single();
    if (error) throw error;

    await admin.from('items').update({ status: 'sold' }).eq('id', order.item_id);

    await createNotification({
      recipientId: order.seller_id,
      type: 'order',
      title: 'Payout released',
      body: `Your payment for ${order.item_title} is on its way.`,
      targetType: 'order',
      targetId: order.id,
      thumbnail: order.item_image || '',
    });

    return new Response(JSON.stringify({ order: updated }), { headers: corsHeaders });
  } catch (error) {
    console.error('releasePayout failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not release the payout.' }), { status: 500, headers: corsHeaders });
  }
});
