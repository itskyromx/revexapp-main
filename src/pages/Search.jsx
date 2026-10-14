import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/api/supabaseClient";
import { Search as SearchIcon, Flame, X, TrendingUp, UserRound } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { formatPrice } from "@/lib/revex";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";
import { PRODUCT_BRANDS, PRODUCT_CATEGORIES, PRODUCT_GENDER_LABELS, PRODUCT_GENDERS } from "@/lib/revex";
import ItemCard from "@/components/ItemCard";
import { hasCookieConsent } from "@/lib/cookieConsent";

const HOT_FALLBACK = ["y2k", "vintage", "streetwear", "archive", "cottagecore", "thrifting"];
const HAUL_FILTERS = ["All", "Jackets", "Denim", "Vintage Tees", "Streetwear", "Y2K", "Cottagecore", "Luxury"];

export default function Search() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [semanticIds, setSemanticIds] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [haulFilter, setHaulFilter] = useState("All");
  const [catalogGender, setCatalogGender] = useState("unisex");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogBrand, setCatalogBrand] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, postsRes, blockedIds, hiddenRes] = await Promise.all([
          supabase.from('items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(60),
          supabase.from('posts').select('*').order('like_count', { ascending: false }).limit(60),
          getBlockedIds(),
          supabase.functions.invoke("getHiddenUserIds", { body: {} }).catch(() => ({ data: { ids: [] } }))
        ]);
        const hiddenIds = [...blockedIds, ...(hiddenRes?.data?.ids || [])];
        setHiddenIds(hiddenIds);
        setItems(hideBlocked(itemsRes.data || [], hiddenIds));
        setPosts(hideBlocked(postsRes.data || [], hiddenIds));
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setProfiles([]);
      setProfilesLoading(false);
      return undefined;
    }

    let active = true;
    setProfilesLoading(true);
    const timer = setTimeout(async () => {
      try {
        const foldedTerm = term.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const terms = [...new Set([
          foldedTerm,
          foldedTerm.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        ].filter(Boolean))];
        const visibility = "hide_from_search.eq.false,hide_from_search.is.null";
        const profileResults = await Promise.all(terms.map((searchTerm) => {
          const pattern = `%${searchTerm.replace(/[\\%_]/g, "\\$&")}%`;
          return supabase.from("profiles")
            .select("id,display_name,avatar,hide_from_search")
            .ilike("display_name", pattern)
            .or(visibility)
            .limit(20);
        }));
        const failedResult = profileResults.find((result) => result.error);
        if (failedResult) throw failedResult.error;

        const uniqueProfiles = new Map();
        profileResults.forEach(({ data }) => {
          (data || []).forEach((profile) => {
            if (profile.id && !profile.hide_from_search) uniqueProfiles.set(profile.id, profile);
          });
        });
        if (active) {
          setProfiles([...uniqueProfiles.values()].filter((profile) => !hiddenIds.includes(profile.id)));
        }
      } catch (error) {
        console.error("Couldn't search profiles:", error);
        if (active) setProfiles([]);
      } finally {
        if (active) setProfilesLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, hiddenIds]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3 || !hasCookieConsent("personalization")) {
      setSemanticIds([]);
      setSemanticLoading(false);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSemanticLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("productSemantics", { body: { mode: "search", query: term } });
        if (error) throw error;
        if (active) setSemanticIds(data?.itemIds || []);
      } catch {
        if (active) setSemanticIds([]);
      } finally {
        if (active) setSemanticLoading(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (!semanticIds.length) return;
    const knownIds = new Set(items.map((item) => item.id));
    const missingIds = semanticIds.filter((id) => !knownIds.has(id));
    if (!missingIds.length) return;
    supabase.from("items").select("*").in("id", missingIds).then(({ data, error }) => {
      if (error || !data?.length) return;
      setItems((current) => [...current, ...data.filter((item) => !current.some((existing) => existing.id === item.id))]);
    }).catch((error) => console.error("Could not load semantic product results", error));
  }, [semanticIds, items]);

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
    const exact = items.filter((it) =>
      [it.title, it.brand, it.size, it.category, ...(it.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 30);
    const exactIds = new Set(exact.map((item) => item.id));
    const semantic = semanticIds.map((id) => items.find((item) => item.id === id)).filter((item) => item && !exactIds.has(item.id));
    return [...exact, ...semantic].slice(0, 30);
  }, [query, items, semanticIds]);

  const catalogItems = useMemo(() => items.filter((item) => {
    const genderMatch = catalogGender === "all" || !item.gender || item.gender === "unisex" || item.gender === catalogGender;
    const categoryMatch = catalogCategory === "all" || item.category === catalogCategory;
    const brandMatch = !catalogBrand || item.brand?.toLowerCase() === catalogBrand.toLowerCase();
    return genderMatch && categoryMatch && brandMatch;
  }), [items, catalogGender, catalogCategory, catalogBrand]);

  const postResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return posts.filter((post) =>
      [post.haul_title, post.caption, post.category, post.creator_name, ...(post.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    ).slice(0, 20);
  }, [query, posts]);

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
              placeholder={t("Search profiles, brands, tags")}
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
          <div className="space-y-6">
            <p className="acid-label">{t('Results for "{query}"', { query })}</p>
            {(profilesLoading || semanticLoading) && profiles.length === 0 && results.length === 0 && postResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("Searching…")}</p>
            ) : profiles.length === 0 && results.length === 0 && postResults.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-display text-lg uppercase">{t("No matches")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("Try a name, post title, tag or brand.")}</p>
              </div>
            ) : (
              <>
                {(profiles.length > 0 || profilesLoading) && (
                  <section>
                    <h3 className="font-display text-lg uppercase mb-3">{t("People ({count})", { count: profiles.length })}</h3>
                    <div className="space-y-2">
                      {profiles.map((profile) => {
                        const name = profile.display_name || t("Revex user");
                        return (
                          <button key={profile.id} onClick={() => navigate(`/profile/${profile.id}`)} className="w-full flex items-center gap-3 border-[3px] border-border bg-card p-2 text-left">
                            <span className="w-11 h-11 shrink-0 rounded-full border-2 border-border bg-muted overflow-hidden grid place-items-center">
                              {profile.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-5 h-5 text-muted-foreground" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-heading font-bold text-sm truncate">{name}</span>
                            </span>
                          </button>
                        );
                      })}
                      {profilesLoading && <p className="text-xs text-muted-foreground">{t("Searching people…")}</p>}
                    </div>
                  </section>
                )}

                {postResults.length > 0 && (
                  <section>
                    <h3 className="font-display text-lg uppercase mb-3">{t("Posts")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {postResults.map((post) => (
                        <button key={post.id} onClick={() => navigate(`/haul/${post.id}`)} className="border-[3px] border-border bg-card overflow-hidden text-left">
                          <div className="aspect-square bg-muted border-b-[3px] border-border">
                            {post.image_urls?.[0] ? <img src={post.image_urls[0]} alt={post.haul_title || "Post"} className="w-full h-full object-cover" /> : <div className="w-full h-full grid-bg" />}
                          </div>
                          <div className="p-2">
                            <p className="font-heading font-bold text-[10px] uppercase truncate">{post.creator_name || "Revex user"}</p>
                            <p className="text-xs truncate">{post.haul_title || post.caption || "Post"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {results.length > 0 && (
                  <section>
                    <h3 className="font-display text-lg uppercase mb-3">{t("Items")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {results.map((it) => (
                        <button key={it.id} onClick={() => navigate(`/item/${it.id}`)} className="border-[3px] border-border bg-card overflow-hidden text-left">
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
                  </section>
                )}
              </>
            )}
          </div>
        ) : (
          <>

            <section className="mb-6">
              <h3 className="font-display text-lg uppercase flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4" /> Shop by category</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {["all", ...PRODUCT_GENDERS].map((gender) => <button key={gender} onClick={() => setCatalogGender(gender)} className={`acid-chip ${catalogGender === gender ? "bg-brand-red text-white" : "bg-card"}`}>{gender === "all" ? "All" : PRODUCT_GENDER_LABELS[gender]}</button>)}
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setCatalogCategory("all")} className={`acid-chip shrink-0 ${catalogCategory === "all" ? "bg-brand-red text-white" : "bg-card"}`}>All types</button>
                {Object.entries(PRODUCT_CATEGORIES).map(([key, value]) => <button key={key} onClick={() => setCatalogCategory(key)} className={`acid-chip shrink-0 ${catalogCategory === key ? "bg-brand-red text-white" : "bg-card"}`}>{value.label}</button>)}
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-display text-lg uppercase mb-3">Shop by brand</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setCatalogBrand("")} className={`acid-chip shrink-0 ${!catalogBrand ? "bg-brand-red text-white" : "bg-card"}`}>All brands</button>
                {PRODUCT_BRANDS.filter((brand) => brand !== "Other").map((brand) => <button key={brand} onClick={() => setCatalogBrand(brand)} className={`acid-chip shrink-0 ${catalogBrand === brand ? "bg-brand-red text-white" : "bg-card"}`}>{brand}</button>)}
              </div>
              {catalogItems.length > 0 ? <div className="grid grid-cols-2 gap-2 mt-3">{catalogItems.slice(0, 8).map((item) => <ItemCard key={item.id} item={item} onClick={() => navigate(`/item/${item.id}`)} />)}</div> : <p className="text-xs text-muted-foreground mt-3">No articles match these filters yet.</p>}
            </section>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
