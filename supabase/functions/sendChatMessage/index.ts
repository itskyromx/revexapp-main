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
    const receiverId = typeof body.receiverId === 'string' ? body.receiverId : '';
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId : null;
    const itemTitle = typeof body.itemTitle === 'string' ? body.itemTitle.slice(0, 200) : '';

    if (!receiverId || !text) {
      return new Response(JSON.stringify({ error: 'A recipient and a message are required.' }), { status: 400, headers: corsHeaders });
    }
    if (receiverId === user.id) {
      return new Response(JSON.stringify({ error: 'You cannot message yourself.' }), { status: 400, headers: corsHeaders });
    }

    const { data: asBlocker } = await supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', receiverId);
    const { data: asBlocked } = await supabase.from('blocks').select('id').eq('blocker_id', receiverId).eq('blocked_id', user.id);
    if (asBlocker?.length || asBlocked?.length) {
      return new Response(JSON.stringify({ error: 'You cannot message this user.' }), { status: 403, headers: corsHeaders });
    }

    const { data: receiver } = await supabase.from('profiles').select('message_pref').eq('id', receiverId).single();
    const pref = receiver?.message_pref || 'everyone';
    if (pref === 'nobody') {
      return new Response(JSON.stringify({ error: 'This user is not accepting messages.' }), { status: 403, headers: corsHeaders });
    }
    if (pref === 'following') {
      const { data: follows } = await supabase.from('follows').select('id').eq('follower_id', receiverId).eq('followee_id', user.id);
      if (!follows?.length) {
        return new Response(JSON.stringify({ error: 'This user only accepts messages from people they follow.' }), { status: 403, headers: corsHeaders });
      }
    }

    const { data: myProfile } = await supabase.from('profiles').select('display_name, email').eq('id', user.id).single();

    const { data: created, error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      sender_name: myProfile?.display_name || myProfile?.email,
      text,
      item_id: itemId,
      item_title: itemTitle,
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ message: created }), { headers: corsHeaders });
  } catch (error) {
    console.error('sendChatMessage failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
