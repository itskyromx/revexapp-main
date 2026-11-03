import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/useAuth";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import { Bookmark, Loader2 } from "lucide-react";
import ItemCard from "@/components/ItemCard";

export default function SavedTab() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { saves, loading: loadingSaves, error: savesError, refresh } = useSaved(user?.id);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isLoadingAuth || loadingSaves || savesError) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const ids = [...new Set(saves.filter(s => s.kind === "item").map(s => s.target_id))];
        if (!ids.length) { if (active) setItems([]); return; }
        const { data, error } = await supabase.from("items").select("*").in("id", ids);
        if (error) throw error;
        if (active) setItems(ids.map(id => (data || []).find(item => item.id === id)).filter(Boolean));
      } catch (error) { if (active) setError(error.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [saves, isLoadingAuth, loadingSaves, savesError]);
  useEffect(() => {
    if (!user?.id) return undefined;
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [user?.id, refresh]);
  if (error || savesError) return <div className="mt-4 space-y-2">
    <p role="alert" className="text-sm text-brand-red">{error || savesError}</p>
    <button className="acid-btn bg-muted" onClick={() => { setError(""); void refresh(); }}>Try again</button>
  </div>;
  if (isLoadingAuth || loadingSaves || loading) return <div className="mt-6 grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!items.length) return <div className="acid-card p-6 mt-4 text-center">
    <Bookmark className="w-6 h-6 mx-auto mb-2" />
    <p className="font-heading font-bold uppercase text-sm">Nothing saved yet</p>
    <p className="text-xs text-muted-foreground mt-1">Tap the bookmark on any item to keep it here for later.</p>
  </div>;
  return <div className="grid grid-cols-2 gap-2 mt-4">{items.map(item => (
    <ItemCard key={item.id} item={item} saved onToggleSave={() => {
      void toggleBookmark(user?.id, "item", item).catch(error => setError(error.message || "Could not update saved items."));
    }}
      onClick={() => navigate(`/item/${item.id}`)} />
  ))}</div>;
}
