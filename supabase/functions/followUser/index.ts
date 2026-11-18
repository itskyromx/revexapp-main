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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    const action = body.action === 'unfollow' ? 'unfollow' : 'follow';
    if (!targetId || targetId === user.id) {
      return new Response(JSON.stringify({ error: 'A user is required.' }), { status: 400, headers: corsHeaders });
    }

    if (action === 'unfollow') {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', targetId);
      return new Response(JSON.stringify({ ok: true, following: false }), { headers: corsHeaders });
    }

    const { data: blocks } = await supabase
      .from('blocks')
      .select('id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${user.id})`);
    if (blocks?.length) {
      return new Response(JSON.stringify({ ok: false, blocked: true, following: false }), { status: 403, headers: corsHeaders });
    }

    const { data: profile } = await supabase.from('profiles').select('display_name, email').eq('id', user.id).single();
    const followerName = profile?.display_name || profile?.email;

    const { error: insertError } = await supabase
      .from('follows')
      .upsert({ follower_id: user.id, followee_id: targetId, follower_name: followerName }, { onConflict: 'follower_id,followee_id' });
    if (insertError) throw insertError;

    await createNotification({
      recipientId: targetId,
      actorId: user.id,
      actorName: followerName,
      actorAvatar: profile?.avatar,
      type: 'follow',
      title: followerName,
      body: 'started following you',
      targetType: 'profile',
      targetId: user.id,
    });

    return new Response(JSON.stringify({ ok: true, following: true }), { headers: corsHeaders });
  } catch (error) {
    console.error('followUser failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
