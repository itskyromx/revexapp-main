import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Check } from "lucide-react";
import ToggleRow from "@/components/settings/ToggleRow";

const MESSAGE_PREFS = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People I follow" },
  { value: "nobody", label: "Nobody" },
];

export default function PrivacySection({ user, setUser }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const update = async (patch) => {
    setBusy(true);
    setSaved(false);
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, ...patch });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ToggleRow
        label="Private account"
        description="Only people you follow back can see your posts and shop."
        checked={Boolean(user?.private_account)}
        onChange={(v) => update({ private_account: v })}
        disabled={busy}
      />
      <ToggleRow
        label="Hide from search"
        description="Keep your profile, shop and posts out of search results and the For You feed."
        checked={Boolean(user?.hide_from_search)}
        onChange={(v) => update({ hide_from_search: v })}
        disabled={busy}
      />

      <div className="acid-card-sm p-3">
        <span className="font-heading font-bold uppercase text-sm">Who can message me</span>
        <p className="text-[11px] text-muted-foreground mt-0.5">Applies to new chats and offers.</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {MESSAGE_PREFS.map((p) => (
            <button
              key={p.value}
              onClick={() => update({ message_pref: p.value })}
              disabled={busy}
              className={`acid-chip ${
                (user?.message_pref || "everyone") === p.value
                  ? "bg-brand-red text-white"
                  : "bg-card text-foreground"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Saved
        </p>
      )}
    </div>
  );
}