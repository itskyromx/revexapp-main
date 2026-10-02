import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import TagChips from "@/components/TagChips";
import { normalizeTags } from "@/lib/revex";

/** Creator-side editing of a post's title, caption and tags. Media is left as is. */
export default function PostEditSheet({ post, onClose, onSaved }) {
  const [title, setTitle] = useState(post.haul_title || "");
  const [caption, setCaption] = useState(post.caption || "");
  const [tags, setTags] = useState(post.tags || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!title.trim()) {
      setError("Give your post a title.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const changes = {
        haul_title: title.trim(),
        caption: caption.trim(),
        tags: normalizeTags(tags),
      };
      await supabase.from('posts').update(changes).eq('id', post.id);
      onSaved({ ...post, ...changes });
    } catch (e) {
      setError(e.message || "Could not save your changes.");
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl border-t-[3px] border-border bg-card p-5 pb-6 max-h-[90vh] overflow-y-auto"
      >
        <SheetTitle className="font-display text-xl uppercase">Edit post</SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">
          Update how your post reads in feeds and search.
        </SheetDescription>

        <div className="mt-4">
          <span className="acid-label">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="acid-input mt-1"
          />
        </div>

        <div className="mt-4">
          <span className="acid-label">Caption</span>
          <textarea
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tell people about this drop…"
            className="acid-input mt-1 resize-none text-sm"
          />
        </div>

        <div className="mt-4">
          <span className="acid-label">Tags</span>
          <div className="mt-1">
            <TagChips value={tags} onChange={setTags} />
          </div>
        </div>

        {error && <p className="text-xs text-brand-red mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={saving} className="acid-btn bg-muted text-foreground flex-1">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="acid-btn bg-brand-red text-white flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save changes"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}