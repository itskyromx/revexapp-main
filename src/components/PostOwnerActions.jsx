import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PostOwnerMenu from "@/components/PostOwnerMenu";
import PostEditSheet from "@/components/PostEditSheet";
import BoostSheet from "@/components/BoostSheet";
import DeletePostDialog from "@/components/DeletePostDialog";

/**
 * The creator's own controls on a post — a trigger button plus the menu and the
 * sheets it opens. Used on the profile grid tile and on the full-screen post.
 */
export default function PostOwnerActions({ post, variant = "overlay", onChanged, onDeleted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const triggerClass =
    variant === "tile"
      ? "absolute top-1.5 right-1.5 z-10 sticker bg-black text-white border-white/30 w-7 h-7 rounded-full flex items-center justify-center"
      : "sticker bg-black/70 text-white border-white/30 w-9 h-9 rounded-full flex items-center justify-center";

  return (
    <>
      <button onClick={() => setMenuOpen(true)} aria-label="Post options" className={triggerClass}>
        <MoreHorizontal className={variant === "tile" ? "w-4 h-4" : "w-5 h-5"} />
      </button>

      <PostOwnerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={() => { setMenuOpen(false); setEditing(true); }}
        onBoost={() => { setMenuOpen(false); setBoosting(true); }}
        onDelete={() => { setMenuOpen(false); setDeleting(true); }}
      />

      {editing && (
        <PostEditSheet
          post={post}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            toast({ title: "Post updated", description: "Your changes are live." });
            onChanged?.(updated);
          }}
        />
      )}

      {boosting && <BoostSheet post={post} onClose={() => setBoosting(false)} />}

      {deleting && (
        <DeletePostDialog
          post={post}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            onDeleted?.();
          }}
        />
      )}
    </>
  );
}