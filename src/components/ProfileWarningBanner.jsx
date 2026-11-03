import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { AlertTriangle, X } from "lucide-react";

export default function ProfileWarningBanner({ userId }) {
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: list } = await supabase.from('warnings').select('*')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (!cancelled) setWarnings((list || []).filter((w) => !w.dismissed));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const dismiss = async (id) => {
    setWarnings((ws) => ws.filter((w) => w.id !== id));
    try {
      await supabase.from('warnings').update({ dismissed: true }).eq('id', id);
    } catch (e) {
      console.error(e);
    }
  };

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {warnings.map((w) => (
        <div key={w.id} className="border-[3px] border-brand-red bg-card p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-display uppercase text-sm text-brand-red">Post removed</p>
              <p className="text-xs mt-1">
                "{w.haul_title || "A Post"}" was removed for breaking our rules — {w.rule}.
              </p>
            </div>
            <button onClick={() => dismiss(w.id)} aria-label="Dismiss warning" className="shrink-0 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}