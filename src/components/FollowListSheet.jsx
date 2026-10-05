import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { loadProfilesById, profileLabel } from "@/lib/profileData";

// Bottom sheet listing the people behind a follower / following count.
export default function FollowListSheet({ title, ids = [], names = {}, emptyText, onClose }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profiles = await loadProfilesById(ids);
      if (cancelled) return;
      setRows(
        ids.map((id) => ({
          id,
          name: profileLabel(profiles[id], names[id] && !names[id].includes("@") ? names[id] : "Creator"),
          avatar: profiles[id]?.avatar,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [ids.join(",")]);

  const openProfile = (id) => {
    onClose();
    navigate(`/profile/${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-background border-t-[4px] border-border flex flex-col max-h-[75vh] animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 h-14 border-b-[3px] border-border shrink-0">
          <span className="font-display text-xl uppercase">{title}</span>
          <button onClick={onClose} aria-label="Close"
            className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {rows === null ? (
            <div className="py-12 grid place-items-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Users className="w-7 h-7 mx-auto text-muted-foreground" />
              <p className="font-heading font-bold uppercase text-sm mt-2">{emptyText}</p>
            </div>
          ) : (
            rows.map((r) => (
              <button key={r.id} onClick={() => openProfile(r.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted">
                <Avatar name={r.name} src={r.avatar} size={44} />
                <span className="font-heading font-bold truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}