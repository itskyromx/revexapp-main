import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { X, Link2, Check, Flag, Loader2, ShieldAlert, ChevronLeft, Eye, EyeOff } from "lucide-react";
import SocialLogo from "@/components/SocialLogos";

const REASONS = [
  { key: "spam", label: "Spam" },
  { key: "inappropriate", label: "Inappropriate" },
  { key: "harassment", label: "Harassment" },
  { key: "misleading", label: "Misleading" },
  { key: "other", label: "Other" },
];

// Targets with a web share intent open directly; the rest hand off to the
// device share sheet so the installed app picks them up.
const TARGETS = [
  { key: "whatsapp", label: "WhatsApp", web: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: "instagram", label: "Instagram", fallbackUrl: "https://www.instagram.com/" },
  { key: "snapchat", label: "Snapchat", fallbackUrl: (u) => `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(u)}` },
  { key: "x", label: "X", web: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: "facebook", label: "Facebook", web: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: "telegram", label: "Telegram", web: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: "tiktok", label: "TikTok", fallbackUrl: "https://www.tiktok.com/" },
];

export default function ShareSheet({ post, onClose, chromeVisible = true, onToggleChrome }) {
  const { user } = useCurrentUser();
  const [view, setView] = useState("share");
  const [copied, setCopied] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [handoff, setHandoff] = useState("");

  const url = `${window.location.origin}/haul/${post.id}`;
  const title = post.haul_title || "Check out this haul on Styld";
  const thumb = post.image_urls?.[0] || "";

  const bumpShare = () => {
    supabase.from('posts')
      .update({ share_count: (post.share_count || 0) + 1 }).eq('id', post.id)
      .then(() => {});
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      bumpShare();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareTo = async (target) => {
    // Networks that publish a link-share intent get it directly.
    if (target.web) {
      bumpShare();
      window.open(target.web(url, title), "_blank", "noopener,noreferrer");
      onClose();
      return;
    }
    // The rest hand off to the phone's own share sheet, which is the only way to
    // share into an app that has no link-share intent of its own.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        bumpShare();
        onClose();
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    // No share sheet on this device: copy the link, open the app so it is one
    // paste away, and say so.
    bumpShare();
    const fb = typeof target.fallbackUrl === "function" ? target.fallbackUrl(url) : target.fallbackUrl;
    if (fb) window.open(fb, "_blank", "noopener,noreferrer");
    try { await navigator.clipboard.writeText(url); } catch {}
    setHandoff(target.label);
    setTimeout(onClose, 2600);
  };

  const submitReport = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('reports').insert({
        post_id: post.id,
        haul_title: post.haul_title || "",
        haul_thumbnail: thumb,
        creator_id: post.created_by_id || null,
        creator_name: post.creator_name || "",
        reporter_id: user?.id || null,
        reporter_name: user?.full_name || user?.email || "Someone",
        reason,
        note: note.trim(),
        status: "open",
      });
      if (error) throw error;
      setSent(true);
      setTimeout(onClose, 1800);
    } catch (e) {
      console.error(e);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-black text-white border-t-[4px] border-white/25 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="max-w-md mx-auto px-4 pb-7 pt-4">
          <div className="flex items-center justify-between mb-4">
            {view === "report" && !sent ? (
              <button onClick={() => setView("share")} className="flex items-center gap-1">
                <ChevronLeft className="w-5 h-5 text-white/70" />
                <span className="font-display text-xl uppercase">Report</span>
              </button>
            ) : (
              <span className="font-display text-xl uppercase">{sent ? "Reported" : "More options"}</span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full border-2 border-white/40 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {view === "share" && (
            <>
              {/* Post preview */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-16 shrink-0 bg-white/10 border-2 border-white/25 overflow-hidden">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid-bg" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display uppercase text-sm leading-tight truncate">
                    {post.haul_title || "Untitled post"}
                  </p>
                  <p className="text-xs text-white/60 truncate">@{post.creator_name?.split(" ")[0]?.toLowerCase() || "styld"}</p>
                </div>
              </div>

              {/* Share targets */}
              <div className="grid grid-cols-4 gap-y-5 gap-x-2">
                {TARGETS.map(({ key, label, web, fallbackUrl }) => (
                  <button
                    key={key}
                    onClick={() => shareTo({ web, label, fallbackUrl })}
                    className="flex flex-col items-center gap-2"
                  >
                    <span className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                      <SocialLogo name={key} className="w-7 h-7 text-white" />
                    </span>
                    <span className="text-[10px] font-heading uppercase tracking-wide text-white/80">{label}</span>
                  </button>
                ))}
              </div>

              {handoff && (
                <p className="mt-4 text-center text-xs text-white/70">
                  Link copied — open {handoff} and paste it into your post.
                </p>
              )}

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="w-full mt-6 flex items-center gap-3 border-2 border-white/25 px-4 py-3 text-left"
              >
                {copied ? <Check className="w-5 h-5 text-white" /> : <Link2 className="w-5 h-5 text-white" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-heading font-bold uppercase text-xs">
                    {copied ? "Link copied" : "Copy link"}
                  </span>
                  <span className="block text-[11px] text-white/50 truncate">{url}</span>
                </span>
              </button>

              {/* Hide / show the content around the post */}
              {onToggleChrome && (
                <button
                  onClick={onToggleChrome}
                  className="w-full mt-3 flex items-center gap-3 border-2 border-white/25 px-4 py-3 text-left"
                >
                  {chromeVisible ? <EyeOff className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-white" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading font-bold uppercase text-xs">
                      {chromeVisible ? "Hide content" : "Show content"}
                    </span>
                    <span className="block text-[11px] text-white/50">
                      {chromeVisible ? "Play the post on its own" : "Bring back the controls"}
                    </span>
                  </span>
                </button>
              )}

              {/* Report */}
              <button
                onClick={() => setView("report")}
                className="w-full mt-3 flex items-center justify-center gap-2 border-2 border-brand-red text-brand-red px-4 py-3"
              >
                <Flag className="w-4 h-4" />
                <span className="font-heading font-bold uppercase text-xs">Report this post</span>
              </button>
            </>
          )}

          {view === "report" && (
            sent ? (
              <div className="py-8 text-center">
                <ShieldAlert className="w-9 h-9 mx-auto text-brand-red" />
                <p className="font-display uppercase text-lg mt-3">Thanks — report sent</p>
                <p className="text-sm text-white/60 mt-1">
                  Our team will review this post and act if it breaks the rules.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-white/70 mb-3">
                  Tell us what's wrong with this post. Your report stays private.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setReason(r.key)}
                      className={`acid-chip ${reason === r.key ? "bg-brand-red text-white border-brand-red" : "bg-transparent text-white border-white/40"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add details (optional)"
                  className="w-full mt-4 bg-transparent border-2 border-white/25 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none resize-none"
                />
                <button
                  onClick={submitReport}
                  disabled={!reason || sending}
                  className="w-full mt-4 bg-brand-red text-white font-display uppercase py-3 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Submit report"}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}