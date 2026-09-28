import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Avatar from "@/components/Avatar";
import { formatPrice, timeAgo, toDate } from "@/lib/styld";

/**
 * One conversation thread per person, derived from the messages and offers
 * exchanged with them.
 */
export default function InboxThreads() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [sentRes, receivedRes, asSellerRes, asBuyerRes, blocksRes, clearsRes] = await Promise.all([
          supabase.from('chat_messages').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(200),
          supabase.from('chat_messages').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(200),
          supabase.from('offers').select('*').eq('seller_id', user.id),
          supabase.from('offers').select('*').eq('buyer_id', user.id),
          supabase.from('blocks').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('chat_clears').select('*').eq('user_id', user.id),
        ]);
        const sent = sentRes.data || [];
        const received = receivedRes.data || [];
        const asSeller = asSellerRes.data || [];
        const asBuyer = asBuyerRes.data || [];
        const blocks = blocksRes.data || [];
        const clears = clearsRes.data || [];

        const msgs = [...sent, ...received];

        // Blocked people and cleared conversations stay out of the inbox.
        const blockedIds = [
          ...new Set([
            ...blocks.filter((b) => b.blocker_id === user.id).map((b) => b.blocked_id),
            ...blocks.filter((b) => b.blocked_id === user.id).map((b) => b.blocker_id),
          ]),
        ].filter(Boolean);
        const clearedAt = Object.fromEntries(clears.map((c) => [c.other_id, c.cleared_at]));

        const map = new Map();
        const touch = (otherId, name, when, preview, isOffer) => {
          if (!otherId || otherId === user.id || !when) return;
          if (blockedIds.includes(otherId)) return;
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

        setThreads([...map.values()].sort((a, b) => toDate(b.at) - toDate(a.at)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" />
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
          key={t.id}
          onClick={() => navigate(`/chat/${t.id}`)}
          className="acid-card w-full p-3 flex items-center gap-3 text-left">
          <Avatar name={t.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-sm truncate">{t.name || "User"}</p>
            <p className={`text-xs truncate ${t.isOffer ? "text-brand-red font-heading" : "text-muted-foreground"}`}>
              {t.preview}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(t.at)}</span>
        </button>
      ))}
    </div>
  );
}