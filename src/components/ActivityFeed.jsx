import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ActivityRow from "@/components/ActivityRow";
import { notificationRoute } from "@/lib/notifications";

/** The activity feed: everything that happened on this account, newest first. */
export default function ActivityFeed() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;

    if (userLoading) {
      setLoading(true);
      return () => { alive = false; };
    }

    if (!user) {
      setItems([]);
      setLoadError("");
      setLoading(false);
      return () => { alive = false; };
    }

    setLoading(true);
    setLoadError("");
    const load = async () => {
      try {
        const { data: list, error } = await supabase.from('notifications').select('*')
          .eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        if (alive) setItems(list || []);
      } catch (error) {
        if (!alive) return;
        console.error("Failed to load activity:", error);
        setItems([]);
        setLoadError("Couldn't load activity. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const channel = supabase
      .channel(`activity:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}`,
      }, () => load())
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, userLoading, retryKey]);

  const open = (n) => {
    if (!n.read) {
      supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => {});
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    navigate(notificationRoute(n));
  };

  const clear = async (n) => {
    setItems((arr) => arr.filter((x) => x.id !== n.id));
    await supabase.from('notifications').delete().eq('id', n.id).then(() => {});
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read);
    if (!unread.length) return;
    setBusy(true);
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true })
      .in('id', unread.map((n) => n.id)).then(() => {});
    setBusy(false);
  };

  const clearRead = async () => {
    if (!items.some((n) => n.read) || !user) return;
    setBusy(true);
    setItems((arr) => arr.filter((n) => !n.read));
    await supabase.from('notifications').delete()
      .eq('recipient_id', user.id).eq('read', true).then(() => {});
    setBusy(false);
  };

  if (userLoading || loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mt-6 text-center">
        <p className="font-display text-lg uppercase">Sign in to view activity</p>
        <button onClick={() => navigate("/login")} className="acid-btn bg-brand-red text-white px-4 py-2 mt-3 text-xs">
          Sign in
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button onClick={() => setRetryKey((key) => key + 1)} className="acid-btn bg-muted text-foreground px-4 py-2 mt-3 text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mt-6 text-center">
        <p className="font-display text-lg uppercase">Nothing new</p>
        <p className="text-sm text-muted-foreground mt-1">
          Offers, sales, messages, order updates and likes land here.
        </p>
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const hasRead = items.some((n) => n.read);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="acid-label">{unreadCount ? `${unreadCount} new` : "All caught up"}</span>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={busy} className="acid-btn bg-muted text-foreground px-3 py-1 text-xs disabled:opacity-50">
              Mark all read
            </button>
          )}
          {hasRead && (
            <button onClick={clearRead} disabled={busy} className="acid-btn bg-muted text-foreground px-3 py-1 text-xs disabled:opacity-50">
              Clear read
            </button>
          )}
        </div>
      </div>

      <div className="divide-y-2 divide-border/30 border-y-2 border-border">
        {items.map((n) => (
          <ActivityRow key={n.id} notification={n} onOpen={open} onClear={clear} />
        ))}
      </div>
    </div>
  );
}