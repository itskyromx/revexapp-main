import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2, Flag, Ban, UserRoundCheck } from "lucide-react";

const ITEMS = [
  {
    key: "delete",
    icon: Trash2,
    label: "Delete chat",
    desc: "Removes this chat from your inbox only.",
    destructive: true,
  },
  {
    key: "report",
    icon: Flag,
    label: "Report user",
    desc: "Flag this person for our team to review.",
    destructive: false,
  },
  {
    key: "block",
    icon: Ban,
    label: "Block user",
    desc: "They can't message you, and you won't see each other's posts.",
    destructive: true,
  },
];

export default function ChatHeaderMenu({ onDelete, onReport, onBlock, blockState = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const pick = (key) => {
    setOpen(false);
    if (key === "delete") onDelete();
    else if (key === "report") onReport();
    else if (key === "block") onBlock();
  };

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chat options"
        className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 acid-card bg-card p-1.5">
          {ITEMS.map((item) => {
            const isBlockItem = item.key === "block";
            const blockedByMe = isBlockItem && blockState === "you";
            const blockedByThem = isBlockItem && blockState === "them";
            const Icon = blockedByMe ? UserRoundCheck : item.icon;
            const label = blockedByMe ? "Unblock user" : blockedByThem ? "Blocked you" : item.label;
            const desc = blockedByMe
              ? "Allow this person to message you and see your posts again."
              : blockedByThem
                ? "This person has blocked you."
                : item.desc;
            const destructive = item.destructive && !blockedByMe;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => pick(item.key)}
                disabled={blockedByThem}
                className="w-full text-left flex gap-2 p-2 hover:bg-muted disabled:opacity-60"
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${destructive ? "text-brand-red" : "text-foreground"}`}
                />
                <span className="min-w-0">
                  <span
                    className={`block font-heading font-bold uppercase text-xs ${destructive ? "text-brand-red" : "text-foreground"}`}
                  >
                    {label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}