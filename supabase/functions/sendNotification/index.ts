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

    const body = await req.json();
    const {
      recipientId, title, content, type = 'message', targetType = 'inbox',
      targetId = '', thumbnail = '', inAppOnly = false,
    } = body;

    if (!recipientId || !content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }
    if (recipientId === user.id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self' }), { headers: corsHeaders });
    }

    const { data: myProfile } = await supabase.from('profiles').select('display_name, email, avatar').eq('id', user.id).single();
    const actorName = myProfile?.display_name || myProfile?.email || 'Unknown';
    const heading = title || actorName;

    const { delivered, blocked } = await createNotification({
      recipientId, actorId: user.id, actorName, actorAvatar: myProfile?.avatar,
      thumbnail, type, title: heading, body: content, targetType, targetId,
    });

    if (blocked) return new Response(JSON.stringify({ ok: true, skipped: 'blocked' }), { headers: corsHeaders });
    if (inAppOnly) return new Response(JSON.stringify({ ok: true, inApp: delivered }), { headers: corsHeaders });

    const { data: recipient } = await admin.from('profiles').select('email').eq('id', recipientId).single();
    if (!recipient?.email) {
      return new Response(JSON.stringify({ ok: true, inApp: delivered, delivered: 'in-app only' }), { headers: corsHeaders });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
