import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
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
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const rating = Math.round(Number(body?.rating));
    const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 600) : '';
    const tags = Array.isArray(body?.tags) ? body.tags.filter((t) => typeof t === 'string').slice(0, 6) : [];

    if (!orderId) return new Response(JSON.stringify({ error: 'Missing order' }), { status: 400, headers: corsHeaders });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Pick a rating from 1 to 5 stars.' }), { status: 400, headers: corsHeaders });
    }

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the buyer can rate this order' }), { status: 403, headers: corsHeaders });
    }
    if (order.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'You can rate the seller once the order is complete.' }), { status: 400, headers: corsHeaders });
    }

    const { data: existing } = await admin.from('reviews').select('*').eq('order_id', order.id).limit(1);
    if (existing?.length) return new Response(JSON.stringify({ review: existing[0], alreadyReviewed: true }), { headers: corsHeaders });

    const { data: myProfile } = await supabase.from('profiles').select('display_name, email, avatar').eq('id', user.id).single();

    const { data: review, error } = await admin.from('reviews').insert({
      order_id: order.id,
      item_id: order.item_id,
      item_title: order.item_title || '',
      seller_id: order.seller_id,
      seller_name: order.seller_name || '',
      buyer_id: user.id,
      buyer_name: myProfile?.display_name || myProfile?.email,
      buyer_avatar: myProfile?.avatar || '',
      rating, comment, tags,
    }).select().single();
    if (error) throw error;

    await createNotification({
      recipientId: order.seller_id,
      actorId: user.id,
      actorName: myProfile?.display_name || myProfile?.email,
      thumbnail: order.item_image || '',
      type: 'order',
      title: 'New rating',
      body: `${myProfile?.display_name || 'A buyer'} rated you ${rating} star${rating === 1 ? '' : 's'}.`,
      targetType: 'profile',
      targetId: order.seller_id,
    });

    return new Response(JSON.stringify({ review }), { headers: corsHeaders });
  } catch (error) {
    console.error('submitReview failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not save your rating.' }), { status: 500, headers: corsHeaders });
  }
});
