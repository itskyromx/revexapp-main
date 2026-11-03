import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import { Bookmark, Loader2 } from "lucide-react";
import ItemCard from "@/components/ItemCard";

/** Everything this user bookmarked — items they may buy later, and posts. */
export default function SavedTab() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { saves } = useSaved(user?.id);
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const itemIds = saves.filter((s) => s.kind === "item").map((s) => s.target_id);
      const postIds = saves.filter((s) => s.kind === "post").map((s) => s.target_id);
      if (!itemIds.length && !postIds.length) {
        if (alive) { setItems([]); setPosts([]); setLoading(false); }
        return;
      }
      const [itsRes, psRes] = await Promise.all([
        itemIds.length
          ? supabase.from('items').select('*').in('id', itemIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from('posts').select('*').in('id', postIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (!alive) return;
      setItems(itsRes.data || []);
      setPosts(psRes.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [saves]);

  const savedItemIds = saves.filter((s) => s.kind === "item").map((s) => s.target_id);
  const savedPostIds = saves.filter((s) => s.kind === "post").map((s) => s.target_id);
  const shownItems = items.filter((i) => savedItemIds.includes(i.id));
  const shownPosts = posts.filter((p) => savedPostIds.includes(p.id));

  if (loading) {
    return (
      <div className="mt-6 grid place-items-center py-10">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (shownItems.length === 0 && shownPosts.length === 0) {
    return (
      <div className="acid-card p-6 mt-4 text-center">
        <Bookmark className="w-6 h-6 mx-auto mb-2" />
        <p className="font-heading font-bold uppercase text-sm">Nothing saved yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tap the bookmark on any item or post to keep it here for later.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {shownItems.length > 0 && (
        <section>
          <h3 className="font-display uppercase text-sm mb-2">
            Items <span className="text-muted-foreground">({shownItems.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {shownItems.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                saved
                onToggleSave={() => toggleBookmark(user?.id, "item", it)}
                onClick={() => navigate(`/item/${it.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {shownPosts.length > 0 && (
        <section>
          <h3 className="font-display uppercase text-sm mb-2">
            Posts <span className="text-muted-foreground">({shownPosts.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {shownPosts.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/haul/${p.id}`)}
                className="acid-card-sm overflow-hidden aspect-[3/4] relative"
              >
                {p.image_urls?.[0] ? (
                  <img src={p.image_urls[0]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full grid-bg bg-muted" />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1.5">
                  <p className="text-white text-[11px] font-heading font-bold line-clamp-2 leading-tight">
                    {p.haul_title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}