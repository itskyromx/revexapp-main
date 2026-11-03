import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ActivityRow from "@/components/ActivityRow";
import { notificationRoute } from "@/lib/notifications";
import { loadProfilesById, profileLabel } from "@/lib/profileData";
import { useI18n } from "@/lib/i18n";

/** The activity feed: everything that happened on this account, newest first. */
export default function ActivityFeed() {
  const { t } = useI18n();
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
        const { error: markReadError } = await supabase.from('notifications')
          .update({ read: true })
          .eq('recipient_id', user.id)
          .eq('read', false);
        if (markReadError) throw markReadError;
        const profiles = await loadProfilesById((list || []).map((item) => item.actor_id));
        if (alive) {
          setItems((list || []).map((item) => {
            const profile = profiles[item.actor_id];
            const fallbackName = item.actor_name && !item.actor_name.includes("@")
              ? item.actor_name
              : "Creator";
            return {
              ...item,
              read: true,
              actor_name: profileLabel(profile, fallbackName),
              actor_avatar: profile?.avatar || item.actor_avatar || "",
            };
          }));
        }
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

  if (loadError) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">{t(loadError)}</p>
        <button onClick={() => setRetryKey((key) => key + 1)} className="acid-btn bg-muted text-foreground px-4 py-2 mt-3 text-xs">
          {t("Retry")}
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mt-6 text-center">
        <p className="font-display text-lg uppercase">{t("Nothing new")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Offers, sales, messages, order updates and likes land here.")}
        </p>
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const hasRead = items.some((n) => n.read);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="acid-label">{unreadCount ? `${unreadCount} ${t("new")}` : t("All caught up")}</span>
        <div className="flex gap-2">
          {hasRead && (
            <button onClick={clearRead} disabled={busy} className="acid-btn bg-muted text-foreground px-3 py-1 text-xs disabled:opacity-50">
              {t("Clear read")}
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
