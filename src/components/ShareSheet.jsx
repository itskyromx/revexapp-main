import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { recordPostShare } from "@/lib/postStats";
import { X, Link2, Check, Flag, Loader2, ShieldAlert, ChevronLeft, Eye, EyeOff, Share2 } from "lucide-react";
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
  { key: "other", label: "Other", native: true },
];

export default function ShareSheet({ post, onClose, chromeVisible = true, onToggleChrome, onShared }) {
  const { user } = useCurrentUser();
  const [view, setView] = useState("share");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [handoff, setHandoff] = useState("");

  const url = `${window.location.origin}/haul/${post.id}`;
  const title = post.haul_title || "Check out this haul on Revex";
  const thumb = post.image_urls?.[0] || "";

  const bumpShare = async () => {
    if (!user?.id) return;
    const updated = await recordPostShare(post.id);
    if (!updated) throw new Error("Share count update did not return a post");
    onShared?.(updated);
  };

  const writeLinkToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {}

    // Clipboard API can be unavailable in embedded browsers or non-secure contexts.
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    field.style.pointerEvents = "none";
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    let copiedSuccessfully = false;
    try { copiedSuccessfully = document.execCommand("copy"); } catch {}
    field.remove();
    return copiedSuccessfully;
  };

  const copyLink = async () => {
    const copiedSuccessfully = await writeLinkToClipboard();
    if (!copiedSuccessfully) {
      setCopied(false);
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    bumpShare().catch((error) => console.error(error));
  };

  const shareTo = async (target) => {
    if (target.native) {
      const payload = { title, text: title, url };
      if (!window.isSecureContext || typeof navigator.share !== "function") {
        setShareFailed("Your browser does not support the phone native share sheet. Open this page in Safari or Chrome.");
        return;
      }
      if (navigator.canShare && !navigator.canShare(payload)) {
        setShareFailed("This phone cannot share this post from the current browser.");
        return;
      }
      setShareFailed("");
      try {
        // Call Web Share API during the tap to preserve OS user activation.
        navigator.share(payload)
          .then(() => { bumpShare().catch((error) => console.error(error)); onClose(); })
          .catch((error) => {
            if (error?.name !== "AbortError") {
              console.error(error);
              setShareFailed("The phone could not open its share sheet. Try opening this page in Safari or Chrome.");
            }
          });
      } catch (error) {
        console.error(error);
        setShareFailed("The phone could not open its share sheet. Try opening this page in Safari or Chrome.");
      }
      return;
    }

    if (target.web) {
      await bumpShare();
      window.open(target.web(url, title), "_blank", "noopener,noreferrer");
      onClose();
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        await bumpShare();
        onClose();
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copiedSuccessfully = await writeLinkToClipboard();
    if (copiedSuccessfully) {
      setCopyFailed(false);
      setCopied(true);
      bumpShare().catch((error) => console.error(error));
    } else {
      setCopyFailed(true);
    }
    const fallback = typeof target.fallbackUrl === "function" ? target.fallbackUrl(url) : target.fallbackUrl;
    if (fallback) window.open(fallback, "_blank", "noopener,noreferrer");
    setHandoff(copiedSuccessfully ? target.label : "your apps");
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
                  <p className="text-xs text-white/60 truncate">@{post.creator_name?.split(" ")[0]?.toLowerCase() || "revexuser"}</p>
                </div>
              </div>

              {/* Share targets */}
              <div className="grid grid-cols-4 gap-y-5 gap-x-2">
                {TARGETS.map(({ key, label, web, fallbackUrl, native }) => (
                  <button
                    key={key}
                    onClick={() => shareTo({ web, label, fallbackUrl, native })}
                    className="flex flex-col items-center gap-2"
                  >
                    <span className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                      {key === "other" ? <Share2 className="w-7 h-7 text-white" /> : <SocialLogo name={key} className="w-7 h-7 text-white" />}
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

              {copyFailed && (
                <p role="status" className="mt-2 text-xs text-white/70">
                  Could not copy the link. Try “Other” to share it from your phone.
                </p>
              )}
              {shareFailed && <p role="status" className="mt-2 text-xs text-white/70">{shareFailed}</p>}

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