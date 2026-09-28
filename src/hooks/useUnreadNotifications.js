import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/** Unread alert count for the Inbox badge, kept fresh by Supabase Realtime. */
export default function useUnreadNotifications() {
  const { user } = useCurrentUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const load = async () => {
      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      if (alive) setCount(unread || 0);
    };

    load();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}`,
      }, () => load())
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return count;
}
