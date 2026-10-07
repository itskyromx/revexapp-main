import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Avatar from "@/components/Avatar";
import { formatPrice, timeAgo, toDate } from "@/lib/revex";
import { loadProfilesById, profileLabel } from "@/lib/profileData";
import { getBlockDirection } from "@/lib/blocks";

/**
 * One conversation thread per person, derived from the messages and offers
 * exchanged with them.
 */
export default function InboxThreads() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useCurrentUser();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;

    if (userLoading) {
      setLoading(true);
      return () => { alive = false; };
    }

    if (!user) {
      setThreads([]);
      setLoadError("");
      setLoading(false);
      return () => { alive = false; };
    }

    setLoading(true);
    setLoadError("");
    (async () => {
      try {
        const [sentRes, receivedRes, asSellerRes, asBuyerRes, clearsRes] = await Promise.all([
          supabase.from('chat_messages').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(200),
          supabase.from('chat_messages').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(200),
          supabase.from('offers').select('*').eq('seller_id', user.id),
          supabase.from('offers').select('*').eq('buyer_id', user.id),
          supabase.from('chat_clears').select('*').eq('user_id', user.id),
        ]);
        const queryError = [sentRes, receivedRes, asSellerRes, asBuyerRes, clearsRes]
          .find((result) => result.error)?.error;
        if (queryError) throw queryError;
        if (!alive) return;

        const sent = sentRes.data || [];
        const received = receivedRes.data || [];
        const asSeller = asSellerRes.data || [];
        const asBuyer = asBuyerRes.data || [];
        const clears = clearsRes.data || [];

        const msgs = [...sent, ...received];

        // Keep blocked conversations visible in the inbox, but disallow sending.
        const clearedAt = Object.fromEntries(clears.map((c) => [c.other_id, c.cleared_at]));

        const map = new Map();
        const touch = (otherId, name, when, preview, isOffer) => {
          if (!otherId || otherId === user.id || !when) return;
          const cleared = clearedAt[otherId];
          if (cleared && toDate(when) <= toDate(cleared)) return;
          const t = map.get(otherId) || { id: otherId, name: "", at: "", preview: "", isOffer: false };
          if (!t.at || toDate(when) >= toDate(t.at)) {
            t.at = when;
            t.preview = preview;
            t.isOffer = isOffer;
          }
          if (!t.name && name) t.name = name;
          map.set(otherId, t);
        };

        msgs.forEach((m) => {
          const mine = m.sender_id === user.id;
          if (!mine && m.receiver_id !== user.id) return;
          const otherId = mine ? m.receiver_id : m.sender_id;
          touch(otherId, mine ? "" : m.sender_name, m.created_at, m.text, false);
        });

        [...asSeller, ...asBuyer].forEach((o) => {
          const iAmSeller = o.seller_id === user.id;
          const otherId = iAmSeller ? o.buyer_id : o.seller_id;
          const name = iAmSeller ? o.buyer_name : "";
          touch(otherId, name, o.created_at, `Offer ${formatPrice(o.amount)} · ${o.item_title}`, true);
        });

        const profiles = await loadProfilesById([...map.keys()]);
        const resolvedThreads = await Promise.all([...map.values()].map(async (thread) => {
          const profile = profiles[thread.id];
          const fallbackName = thread.name && !thread.name.includes("@") ? thread.name : "User";
          const blockDirection = await getBlockDirection(user.id, thread.id);
          return {
            ...thread,
            name: profileLabel(profile, fallbackName),
            avatar: profile?.avatar || "",
            blocked: Boolean(blockDirection),
          };
        }));
        setThreads(resolvedThreads.sort((a, b) => toDate(b.at) - toDate(a.at)));
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setThreads([]);
        setLoadError("Couldn't load chats. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, userLoading, retryKey]);

  useEffect(() => {
    const reload = () => setRetryKey((key) => key + 1);
    window.addEventListener('revex:block-changed', reload);
    window.addEventListener('revex:chat-cleared', reload);
    return () => {
      window.removeEventListener('revex:block-changed', reload);
      window.removeEventListener('revex:chat-cleared', reload);
    };
  }, []);

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
        <p className="font-display text-lg uppercase">Sign in to view chats</p>
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

  if (!threads.length) {
    return (
      <div className="mt-6 text-center">
        <p className="font-display text-lg uppercase">No chats yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Message a seller or send an offer and your conversation shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <button
          onClick={() => navigate(`/chat/${t.id}`)}
          key={t.id}
          className={`acid-card w-full p-3 flex items-center gap-3 text-left ${t.blocked ? "opacity-80" : ""}`}
          aria-label={t.blocked ? "Blocked conversation" : `Open conversation with ${t.name}`}
        >
          <Avatar name={t.name} src={t.avatar} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-sm truncate">{t.name || "User"}</p>
            <p className={`text-xs truncate ${t.isOffer ? "text-brand-red font-heading" : "text-muted-foreground"}`}>
              {t.blocked ? "This conversation is blocked" : t.preview}
            </p>
          </div>
          {t.blocked ? (
            <span className="text-[10px] font-heading uppercase text-muted-foreground shrink-0">Blocked</span>
          ) : (
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(t.at)}</span>
          )}
        </button>
      ))}
    </div>
  );
}