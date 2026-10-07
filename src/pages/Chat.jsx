import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ArrowLeft, Send, Ban } from "lucide-react";
import Avatar from "@/components/Avatar";
import OfferCard from "@/components/OfferCard";
import CheckoutSheet from "@/components/CheckoutSheet";
import ChatHeaderMenu from "@/components/ChatHeaderMenu";
import ReportUserSheet from "@/components/ReportUserSheet";
import MessageBubble from "@/components/MessageBubble";
import MessageActionSheet from "@/components/MessageActionSheet";
import { toast } from "@/components/ui/use-toast";
import { formatPrice, toDate, displayName, timeAgo } from "@/lib/revex";
import { clearChatHistory, getBlockRelationship, setBlockRelationship } from "@/lib/blocks";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAID_STATUSES = ["paid", "in_transit", "completed"];

export default function Chat() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const itemId = params.get("itemId");
  const navigate = useNavigate();
  const { user: me } = useCurrentUser();
  const [other, setOther] = useState(null);
  const [item, setItem] = useState(null);
  const [messages, setMessages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [paidItemIds, setPaidItemIds] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyOffer, setBusyOffer] = useState("");
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [checkoutOffer, setCheckoutOffer] = useState(null);
  const [cantMessage, setCantMessage] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [messageToAct, setMessageToAct] = useState(null);
  const [theirLastRead, setTheirLastRead] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [, setTick] = useState(0);
  const endRef = useRef(null);
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  const load = async () => {
    if (!me || !userId) return;
    try {
      const [uRes, sentRes, receivedRes, theirOffersRes, myOffersRes, ordersRes, blocksRes, clearsRes, theirReadsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('chat_messages').select('*').eq('sender_id', me.id).eq('receiver_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('chat_messages').select('*').eq('sender_id', userId).eq('receiver_id', me.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('offers').select('*').eq('seller_id', userId).eq('buyer_id', me.id),
        supabase.from('offers').select('*').eq('buyer_id', userId).eq('seller_id', me.id),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
        getBlockRelationship(me.id, userId),
        supabase.from('chat_clears').select('*').eq('user_id', me.id).eq('other_id', userId),
        supabase.from('chat_reads').select('*').eq('user_id', userId).eq('other_id', me.id),
      ]);
      const u = uRes.data;
      const sent = sentRes.data || [];
      const received = receivedRes.data || [];
      const theirOffers = theirOffersRes.data || [];
      const myOffers = myOffersRes.data || [];
      const orders = ordersRes.data || [];
      const blocked = blocksRes === true;
      const clears = clearsRes.data || [];
      const theirReads = theirReadsRes.data || [];
      setOther(u);
      setTheirLastRead(theirReads[0]?.last_read_at || null);
      setOffers([...theirOffers, ...myOffers]);
      setPaidItemIds(orders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.item_id));
      setCantMessage(blocked);
      const clearedAt = clears[0]?.cleared_at;
      const conv = [...sent, ...received]
        .filter(Boolean)
        .filter((m) => !clearedAt || (m.created_at && toDate(m.created_at) > toDate(clearedAt)))
        .sort((a, b) => toDate(a.created_at) - toDate(b.created_at));
      setMessages(conv);
      if (itemId) {
        const { data: it } = await supabase.from('items').select('*').eq('id', itemId).single();
        setItem(it);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [me, userId, itemId]);

  useEffect(() => {
    const reload = () => load();
    window.addEventListener('revex:block-changed', reload);
    return () => window.removeEventListener('revex:block-changed', reload);
  }, [me, userId, itemId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, offers]);

  // Read receipt: opening the thread — or receiving a message while it's open —
  // stamps when I last read this conversation.
  useEffect(() => {
    if (!me || !userId || loading) return;
    const stamp = new Date().toISOString();
    supabase.from('chat_reads').select('*').eq('user_id', me.id).eq('other_id', userId)
      .then(({ data: rows }) =>
        rows?.[0]
          ? supabase.from('chat_reads').update({ last_read_at: stamp }).eq('id', rows[0].id)
          : supabase.from('chat_reads').insert({ user_id: me.id, other_id: userId, last_read_at: stamp })
      )
      .catch(() => {});
  }, [messages, loading, me, userId]);

  // Their receipt arrives live, so the sender sees "Seen" without refreshing.
  useEffect(() => {
    if (!me || !userId) return;
    const channel = supabase
      .channel(`chat_reads:${me.id}:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_reads', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const d = payload.new;
        if (d?.other_id === me.id) setTheirLastRead(d.last_read_at || null);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [me, userId]);

  // Keeps the relative "Seen 5m ago" label ticking.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const send = async () => {
    if (!text.trim() || !me || cantMessage || sending) return;
    const body = text.trim();
    const sentAt = new Date().toISOString();
    setSending(true);

    try {
      const { data: persistedMessage, error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: me.id,
          receiver_id: userId,
          sender_name: displayName(me) || me.email,
          text: body,
          created_at: sentAt,
          item_id: itemId || null,
          item_title: item?.title || null,
        })
        .select("*")
        .single();

      if (error) throw error;
      setMessages((current) => {
        const safeCurrent = Array.isArray(current) ? current.filter(Boolean) : [];
        if (safeCurrent.some((message) => message.id === persistedMessage.id)) return safeCurrent;
        return [...safeCurrent, persistedMessage];
      });
      setText("");
      supabase.functions.invoke('sendNotification', { body: {
        recipientId: userId,
        title: displayName(me) || me.email,
        content: body.slice(0, 100),
        actionUrl: `/chat/${me.id}`,
        type: "message",
        targetType: "chat",
        targetId: me.id,
        thumbnail: item?.image_url || "",
      }}).catch(() => {});
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't send message", description: "Check your connection and try again." });
    } finally {
      setSending(false);
    }
  };

  const respond = async (offer, status) => {
    setBusyOffer(offer.id);
    try {
      await supabase.from('offers').update({ status }).eq('id', offer.id);
      setOffers((arr) => arr.map((o) => (o.id === offer.id ? { ...o, status } : o)));
      if (status === "accepted") {
        await supabase.from('items').update({ status: "reserved" }).eq('id', offer.item_id).then(() => {});
        supabase.functions.invoke("sendNotification", { body: {
          recipientId: offer.buyer_id,
          title: "Offer accepted",
          content: `Your ${formatPrice(offer.amount)} offer on ${offer.item_title} was accepted — pay now.`,
          actionUrl: `/chat/${me.id}`,
          type: "offer_accepted",
          targetType: "chat",
          targetId: me.id,
          thumbnail: offer.item_image || "",
        }}).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
    setBusyOffer("");
  };

  const payOffer = async (offer) => {
    setBusyOffer(offer.id);
    try {
      const { data: it } = await supabase.from('items').select('*').eq('id', offer.item_id).single();
      setCheckoutItem(it);
      setCheckoutOffer(offer);
    } catch (e) {
      console.error(e);
    }
    setBusyOffer("");
  };

  const deleteChat = async () => {
    if (!me || !userId) return;
    setBusyAction(true);
    try {
      await clearChatHistory(me.id, userId);
      navigate("/inbox");
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't delete chat", description: "Try again." });
    } finally {
      setBusyAction(false);
      setConfirm("");
    }
  };

  const blockUser = async () => {
    if (!me) return;
    setBusyAction(true);
    try {
      await setBlockRelationship(me.id, userId);
      setCantMessage(true);
      navigate("/inbox");
    } catch (e) {
      console.error(e);
    } finally {
      setBusyAction(false);
      setConfirm("");
    }
  };

  const copyMessage = async (msg) => {
    setMessageToAct(null);
    try {
      await navigator.clipboard.writeText(msg.text);
      toast({ title: "Copied", description: "Message copied to your clipboard." });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't copy", description: "Your browser blocked the clipboard." });
    }
  };

  const deleteMessage = async () => {
    if (!messageToDelete) return;
    const id = messageToDelete.id;
    setBusyAction(true);
    try {
      await supabase.from('chat_messages').delete().eq('id', id);
      setMessages((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyAction(false);
      setMessageToDelete(null);
    }
  };

  const timeline = [
    ...safeMessages.map((m) => ({ kind: "msg", at: m.created_at, data: m })),
    ...offers.map((o) => ({ kind: "offer", at: o.created_at, data: o })),
  ].filter((item) => item.at).sort((a, b) => new Date(a.at) - new Date(b.at));

  // Delivered / Seen line — shown only under my most recent message.
  const lastMine = [...safeMessages].reverse().find((m) => m.sender_id === me?.id);
  const seenAgo = theirLastRead ? timeAgo(theirLastRead) : "";
  const myStatus =
    lastMine && theirLastRead && lastMine.created_at && toDate(theirLastRead) >= toDate(lastMine.created_at)
      ? /^\d+[smhd]$/.test(seenAgo)
        ? `Seen ${seenAgo} ago`
        : `Seen ${seenAgo}`
      : "Delivered";

  const otherName =
    displayName(other) ||
    safeMessages.find((m) => m.sender_id === userId)?.sender_name ||
    offers.find((o) => o.buyer_id === userId)?.buyer_name ||
    "User";

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: "100vh" }}>
      <header className="border-b-[4px] border-border bg-muted shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <button
            onClick={() => navigate(`/profile/${userId}`)}
            aria-label={`View ${otherName}'s profile`}
            className="shrink-0 active:opacity-70"
          >
            <Avatar name={otherName} src={other?.avatar} size={36} />
          </button>
          <div className="min-w-0">
            <p className="font-display text-sm uppercase truncate">{otherName}</p>
          </div>
          <ChatHeaderMenu
            onDelete={() => setConfirm("delete")}
            onReport={() => setShowReport(true)}
            onBlock={() => setConfirm("block")}
          />
        </div>
      </header>

      {item && (
        <button onClick={() => navigate(`/item/${item.id}`)} className="acid-card-sm bg-card mx-auto max-w-md w-full m-3 p-2 flex items-center gap-2">
          {item.image_url && <img src={item.image_url} className="w-12 h-12 object-cover border-2 border-border" alt="" />}
          <div className="text-left min-w-0">
            <p className="font-heading font-bold text-sm truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground">{formatPrice(item.price)} · tap to view</p>
          </div>
        </button>
      )}

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-3 space-y-2">
        {timeline.length === 0 && <p className="text-center text-muted-foreground text-sm mt-8">Say hi 👋 — arrange shipping & payment here.</p>}
        {timeline.map((row) => {
          if (row.kind === "offer") {
            const o = row.data;
            return (
              <div key={`offer-${o.id}`} className="flex justify-center">
                <OfferCard
                  offer={o}
                  me={me}
                  paid={paidItemIds.includes(o.item_id)}
                  busy={busyOffer === o.id}
                  onRespond={respond}
                  onPay={payOffer}
                  onOpenItem={() => navigate(`/item/${o.item_id}`)}
                />
              </div>
            );
          }
          const m = row.data;
          const mine = m.sender_id === me.id;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={mine}
              status={m.id === lastMine?.id ? myStatus : null}
              onHold={setMessageToAct}
            />
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t-[4px] border-border bg-card shrink-0">
        {cantMessage ? (
          <div className="max-w-md mx-auto flex items-center justify-center gap-2 p-3">
            <Ban className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-heading uppercase text-muted-foreground">
              You can't message this user
            </p>
          </div>
        ) : (
          <div className="max-w-md mx-auto flex items-center gap-2 p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message..."
              className="acid-input flex-1"
            />
            <button onClick={send} disabled={!text.trim() || sending} className="acid-btn bg-brand-red text-white px-3 disabled:opacity-40">
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {checkoutItem && checkoutOffer && (
        <CheckoutSheet
          item={checkoutItem}
          offer={checkoutOffer}
          onClose={() => { setCheckoutItem(null); setCheckoutOffer(null); }}
        />
      )}

      {showReport && me && (
        <ReportUserSheet targetId={userId} name={otherName} me={me} onClose={() => setShowReport(false)} />
      )}

      <MessageActionSheet
        message={messageToAct}
        mine={messageToAct?.sender_id === me?.id}
        onCopy={() => copyMessage(messageToAct)}
        onDelete={() => {
          setMessageToDelete(messageToAct);
          setMessageToAct(null);
        }}
        onClose={() => setMessageToAct(null)}
      />

      <AlertDialog open={confirm === "delete"} onOpenChange={(open) => { if (!open) setConfirm(""); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation disappears from your inbox only — {otherName} keeps their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteChat} disabled={busyAction}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase">
              {busyAction ? "Deleting…" : "Delete chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "block"} onOpenChange={(open) => { if (!open) setConfirm(""); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Block {otherName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to message you, you won't see their posts, and they won't see yours.
              You can unblock them any time from their profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={blockUser} disabled={busyAction}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase">
              {busyAction ? "Blocking…" : "Block user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => { if (!open) setMessageToDelete(null); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the conversation for both of you. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMessage} disabled={busyAction}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase">
              {busyAction ? "Deleting…" : "Delete message"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}