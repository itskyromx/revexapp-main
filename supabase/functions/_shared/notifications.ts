import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);

export async function createNotification({
  recipientId, actorId = '', actorName = '', actorAvatar = '', thumbnail = '',
  type = 'message', title, body = '', targetType = 'inbox', targetId = '',
}) {
  if (!recipientId || !title) return { delivered: false, blocked: false };
  if (actorId && actorId === recipientId) return { delivered: false, blocked: false };

  try {
    if (actorId) {
      const [{ data: asBlocker }, { data: asBlocked }] = await Promise.all([
        admin.from('blocks').select('id').eq('blocker_id', actorId).eq('blocked_id', recipientId),
        admin.from('blocks').select('id').eq('blocker_id', recipientId).eq('blocked_id', actorId),
      ]);
      if (asBlocker?.length || asBlocked?.length) return { delivered: false, blocked: true };
    }

    const { error } = await admin.from('notifications').insert({
      recipient_id: recipientId,
      actor_id: actorId,
      actor_name: actorName,
      actor_avatar: actorAvatar,
      thumbnail,
      type,
      title,
      body,
      target_type: targetType,
      target_id: targetId,
      read: false,
    });
    if (error) throw error;
    return { delivered: true, blocked: false };
  } catch (error) {
    console.error('createNotification failed:', error?.message || error);
    return { delivered: false, blocked: false };
  }
}
