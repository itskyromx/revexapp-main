import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Search as SearchIcon, Flame, X, TrendingUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { CATEGORY_LABELS } from "@/lib/revex";
import { formatPrice } from "@/lib/revex";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const HOT_FALLBACK = ["y2k", "vintage", "streetwear", "archive", "cottagecore", "thrifting"];
const HAUL_FILTERS = ["All", "Jackets", "Denim", "Vintage Tees", "Streetwear", "Y2K", "Cottagecore", "Luxury"];

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [haulFilter, setHaulFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, postsRes, blockedIds, hiddenRes] = await Promise.all([
          supabase.from('items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(60),
          supabase.from('posts').select('*').order('like_count', { ascending: false }).limit(12),
          getBlockedIds(),
          supabase.functions.invoke("getHiddenUserIds", { body: {} }).catch(() => ({ data: { ids: [] } }))
        ]);
        const hiddenIds = [...blockedIds, ...(hiddenRes?.data?.ids || [])];
        setItems(hideBlocked(itemsRes.data || [], hiddenIds));
        setPosts(hideBlocked(postsRes.data || [], hiddenIds));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const hotSearches = useMemo(() => {
    const counts = {};
    posts.forEach((p) => (p.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    return (sorted.length ? sorted : HOT_FALLBACK).slice(0, 8);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (haulFilter === "All") return posts;
    const key = haulFilter.toLowerCase();
    return posts.filter((p) => {
      const cat = (p.category || "").toLowerCase().includes(key);
      const tag = (p.tags || []).some((t) => t.toLowerCase().includes(key));
      const title = (p.haul_title || "").toLowerCase().includes(key);
      return cat || tag || title;
    });
  }, [posts, haulFilter]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((it) =>
      [it.title, it.brand, it.size, it.category, ...(it.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 30);
  }, [query, items]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Search bar */}
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-2 px-3 h-14">
          <div className="flex-1 flex items-center gap-2 border-[3px] border-border bg-card px-3 h-10">
            <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drops, brands, tags…"
              className="bg-transparent flex-1 outline-none text-sm" />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4">
        {query.trim() ? (
          <section>
            <p className="acid-label mb-3">{results.length} result{results.length === 1 ? "" : "s"} for "{query}"</p>
            {results.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-display text-lg uppercase">No matches</p>
                <p className="text-sm text-muted-foreground mt-1">Try a tag or brand name.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {results.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => navigate(`/item/${it.id}`)}
                    className="border-[3px] border-border bg-card overflow-hidden text-left">
                    <div className="aspect-square bg-muted border-b-[3px] border-border">
                      {it.image_url ? <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" /> : <div className="w-full h-full grid-bg" />}
                    </div>
                    <div className="p-2">
                      <p className="font-heading font-bold text-[10px] uppercase truncate">{it.brand || "Brand"}</p>
                      <p className="text-xs truncate">{it.title}</p>
                      <p className="font-display text-base mt-0.5">{formatPrice(it.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Hot searches */}
            <section className="mb-6">
              <h3 className="font-display text-lg uppercase flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-brand-red" /> Hot searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {hotSearches.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="acid-chip bg-card hover:bg-brand-red hover:text-white">
                    #{t}
                  </button>
                ))}
              </div>
            </section>

            {/* Browse categories */}
            <section className="mb-6">
              <h3 className="font-display text-lg uppercase flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" /> Browse categories
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setQuery(CATEGORY_LABELS[c].toLowerCase())}
                    className="aspect-square border-[3px] border-border bg-card flex items-center justify-center hover:bg-brand-red hover:text-white transition-colors p-1">
                    <span className="font-display uppercase text-xs text-center">{CATEGORY_LABELS[c]}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Trending hauls */}
            {posts.length > 0 && (
              <section>
                <h3 className="font-display text-lg uppercase mb-3">Trending hauls</h3>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3 -mx-4 px-4">
                  {HAUL_FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setHaulFilter(f)}
                      className={`acid-chip shrink-0 ${haulFilter === f ? "bg-brand-red text-white border-brand-red" : "bg-card hover:bg-muted"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {filteredPosts.length === 0 ? (
                    <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No hauls match "{haulFilter}".</p>
                  ) : filteredPosts.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate("/watch")}
                      className="aspect-[3/4] border-[3px] border-border bg-black relative overflow-hidden">
                      {p.video_url ? <video src={p.video_url} className="w-full h-full object-cover opacity-90" muted playsInline /> :
                        p.image_urls?.[0] ? <img src={p.image_urls[0]} className="w-full h-full object-cover opacity-90" alt="" /> :
                        <div className="w-full h-full grid-bg" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <p className="absolute bottom-2 left-2 right-2 font-display text-white text-xs uppercase line-clamp-2">{p.haul_title}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}