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
import { formatPrice, toDate, displayName, timeAgoVerbose } from "@/lib/revex";
import { clearChatHistory, getBlockDirection, setBlockRelationship, clearBlockRelationship } from "@/lib/blocks";
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
  const [blockDirection, setBlockDirection] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [messageToAct, setMessageToAct] = useState(null);
  const [theirLastRead, setTheirLastRead] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [, setTick] = useState(0);
  const endRef = useRef(null);
  const clearedAtRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingIdleRef = useRef(null);
  const typingChannelRef = useRef(null);
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
        getBlockDirection(me.id, userId),
        supabase.from('chat_clears').select('*').eq('user_id', me.id).eq('other_id', userId),
        supabase.from('chat_reads').select('*').eq('user_id', userId).eq('other_id', me.id),
      ]);
      const u = uRes.data;
      const sent = sentRes.data || [];
      const received = receivedRes.data || [];
      const theirOffers = theirOffersRes.data || [];
      const myOffers = myOffersRes.data || [];
      const orders = ordersRes.data || [];
      const blockState = blocksRes;
      const blocked = Boolean(blockState);
      const clears = clearsRes.data || [];
      const theirReads = theirReadsRes.data || [];
      setOther(u);
      setTheirLastRead(theirReads[0]?.last_read_at || null);
      setOffers([...theirOffers, ...myOffers]);
      setPaidItemIds(orders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.item_id));
      setBlockDirection(blockState);
      setCantMessage(blocked);
      const clearedAt = clears[0]?.cleared_at;
      clearedAtRef.current = clearedAt || null;
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
    if (!me?.id || !userId) return undefined;
    const channel = supabase.channel(`chat-messages:${me.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${userId}` }, ({ new: message }) => {
        if (message?.receiver_id !== me.id || !message.id) return;
        if (clearedAtRef.current && toDate(message.created_at) <= toDate(clearedAtRef.current)) return;
        setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message].sort((a, b) => toDate(a.created_at) - toDate(b.created_at)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${me.id}` }, ({ new: message }) => {
        if (message?.receiver_id !== userId || !message.id) return;
        setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message].sort((a, b) => toDate(a.created_at) - toDate(b.created_at)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_message_deletions', filter: `sender_id=eq.${me.id}` }, ({ new: deletion }) => {
        if (deletion?.receiver_id !== userId || !deletion.message_id) return;
        setMessages((current) => current.filter((message) => message.id !== deletion.message_id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_message_deletions', filter: `receiver_id=eq.${me.id}` }, ({ new: deletion }) => {
        if (deletion?.sender_id !== userId || !deletion.message_id) return;
        setMessages((current) => current.filter((message) => message.id !== deletion.message_id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me?.id, userId]);

  useEffect(() => {
    if (!me?.id || !userId) return undefined;
    const applyBlock = (direction) => {
      setBlockDirection(direction);
      setCantMessage(true);
      setText("");
      setOtherTyping(false);
    };
    const channel = supabase.channel(`chat-blocks:${me.id}:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'blocks', filter: `blocker_id=eq.${me.id}`,
      }, ({ new: row }) => {
        if (row?.blocked_id === userId) applyBlock("you");
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'blocks', filter: `blocked_id=eq.${me.id}`,
      }, ({ new: row }) => {
        if (row?.blocker_id === userId) applyBlock("them");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me?.id, userId]);

  useEffect(() => {
    if (!me?.id || !userId) return undefined;
    const channel = supabase.channel(`chat-clears:${me.id}:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_clears', filter: `user_id=eq.${me.id}`,
      }, ({ new: clear }) => {
        if (clear?.other_id !== userId || !clear.cleared_at) return;
        clearedAtRef.current = clear.cleared_at;
        setMessages((current) => current.filter((message) => (
          message.created_at && toDate(message.created_at) > toDate(clear.cleared_at)
        )));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me?.id, userId]);

  useEffect(() => {
    if (!me?.id || !userId) return undefined;
    const pair = [me.id, userId].sort().join(':');
    const channel = supabase.channel(`chat-typing:${pair}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.userId !== userId) return;
      setOtherTyping(Boolean(payload.isTyping));
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (payload.isTyping) typingIdleRef.current = setTimeout(() => setOtherTyping(false), 2500);
    }).subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [me?.id, userId]);

  const announceTyping = (value) => {
    const channel = typingChannelRef.current;
    if (!channel || !me?.id) return;
    channel.send({ type: 'broadcast', event: 'typing', payload: { userId: me.id, isTyping: Boolean(value) } });
  };

  const handleTextChange = (value) => {
    setText(value);
    if (!value.trim() || cantMessage) { announceTyping(false); return; }
    announceTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => announceTyping(false), 1800);
  };


  useEffect(() => {
    const reload = () => load();
    window.addEventListener('revex:block-changed', reload);
    return () => window.removeEventListener('revex:block-changed', reload);
  }, [me, userId, itemId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, offers]);

  // Advance the receipt only when a newer incoming message exists. Reopening
  // messages that were already seen must preserve their original timestamp.
  useEffect(() => {
    if (!me || !userId || loading) return undefined;
    const latestIncoming = safeMessages
      .filter((message) => message.sender_id === userId && message.created_at)
      .reduce((latest, message) => (
        !latest || toDate(message.created_at) > toDate(latest.created_at) ? message : latest
      ), null);
    if (!latestIncoming) return undefined;

    let active = true;
    const markIncomingRead = async () => {
      const { data: existing, error: readError } = await supabase.from('chat_reads')
        .select('id,last_read_at').eq('user_id', me.id).eq('other_id', userId).maybeSingle();
      if (readError) throw readError;
      if (!active) return;

      const incomingAt = toDate(latestIncoming.created_at);
      const previouslyReadAt = toDate(existing?.last_read_at);
      if (previouslyReadAt && incomingAt && previouslyReadAt >= incomingAt) return;

      const stamp = new Date(Math.max(Date.now(), incomingAt?.getTime() || 0)).toISOString();
      const result = existing
        ? await supabase.from('chat_reads').update({ last_read_at: stamp }).eq('id', existing.id)
        : await supabase.from('chat_reads').insert({ user_id: me.id, other_id: userId, last_read_at: stamp });
      if (result.error) throw result.error;
    };

    markIncomingRead().catch((error) => console.error('Could not save read receipt', error));
    return () => { active = false; };
  }, [messages, loading, me?.id, userId]);

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
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const send = async () => {
    if (!text.trim() || !me || cantMessage || sending) return;
    const body = text.trim();
    setSending(true);

    try {
      const { data: persistedMessage, error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: me.id,
          receiver_id: userId,
          sender_name: displayName(me) || me.email,
          text: body,
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
      announceTyping(false);
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
      const direction = await setBlockRelationship(me.id, userId);
      setBlockDirection(direction);
      setCantMessage(Boolean(direction));
      if (direction === "you") navigate("/inbox");
      else toast({ title: "User already blocked you", description: "You cannot change their block from your account." });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't block user", description: "Try again." });
    } finally {
      setBusyAction(false);
      setConfirm("");
    }
  };

  const unblockUser = async () => {
    if (!me || blockDirection !== "you") return;
    setBusyAction(true);
    try {
      await clearBlockRelationship(me.id, userId);
      setBlockDirection(null);
      setCantMessage(false);
      toast({ title: "User unblocked" });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't unblock user", description: "Try again." });
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
      const { data: deletedMessage, error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!deletedMessage) throw new Error("Messages can't be deleted after the other user has replied.");
      setMessages((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't delete message", description: e.message || "Try again." });
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
  const seenAgo = theirLastRead ? timeAgoVerbose(theirLastRead) : "";
  const myStatus =
    lastMine && theirLastRead && lastMine.created_at && toDate(theirLastRead) >= toDate(lastMine.created_at)
      ? "Seen " + seenAgo + " ago"
      : "Delivered";

  const otherName =
    displayName(other) ||
    safeMessages.find((m) => m.sender_id === userId)?.sender_name ||
    offers.find((o) => o.buyer_id === userId)?.buyer_name ||
    "User";

  const messageToActHasReply = Boolean(messageToAct && safeMessages.some((message) => (
    message.sender_id === messageToAct.receiver_id &&
    message.receiver_id === messageToAct.sender_id &&
    toDate(message.created_at) >= toDate(messageToAct.created_at)
  )));

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
            blockState={blockDirection}
            onBlock={() => setConfirm(blockDirection === "you" ? "unblock" : "block")}
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
        {otherTyping && <p className="text-xs text-muted-foreground px-2 py-1" aria-live="polite">{otherName} is typing…</p>}
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
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={() => announceTyping(false)}
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
        canDelete={!messageToActHasReply}
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

      <AlertDialog open={confirm === "block" || confirm === "unblock"} onOpenChange={(open) => { if (!open) setConfirm(""); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">
              {confirm === "unblock" ? "Unblock" : "Block"} {otherName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "unblock"
                ? "They will be able to message you and see your posts again."
                : "They won't be able to message you, you won't see their posts, and they won't see yours. You can unblock them any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm === "unblock" ? unblockUser : blockUser} disabled={busyAction}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase">
              {busyAction ? (confirm === "unblock" ? "Unblocking…" : "Blocking…") : (confirm === "unblock" ? "Unblock user" : "Block user")}
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
