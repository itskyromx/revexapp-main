import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Check, Loader2 } from "lucide-react";
import { toDate } from "@/lib/styld";

export default function PersonalDetailsSection({ user, setUser }) {
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.shipping_address || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const joined = toDate(user?.created_at);
  const accountRows = [
    ["Account name", user?.full_name || "—"],
    ["Email", user?.email || "—"],
    [
      "Member since",
      joined ? joined.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—",
    ],
  ];

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const { error } = await supabase.from('profiles')
        .update({ phone: phone.trim(), shipping_address: address.trim() }).eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, phone: phone.trim(), shipping_address: address.trim() });
      setSaved(true);
    } catch (e) {
      setError(e.message || "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="acid-card-sm p-3 space-y-2">
        {accountRows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="acid-label shrink-0">{label}</span>
            <span className="text-sm truncate">{value}</span>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Your account name and email are set when you sign up and can't be changed here.
        </p>
      </div>

      <div>
        <span className="acid-label">Phone number</span>
        <input
          type="tel"
          className="acid-input mt-1"
          placeholder="+351 900 000 000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground mt-1">Private — never shown on your profile.</p>
      </div>

      <div>
        <span className="acid-label">Shipping address</span>
        <textarea
          rows={3}
          className="acid-input mt-1 resize-none"
          placeholder="Street, city, postcode"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Prefilled at checkout, and only shared with the seller when you buy.
        </p>
      </div>

      {error && <p className="text-xs text-brand-red">{error}</p>}

      <button onClick={save} disabled={busy} className="acid-btn bg-brand-red text-white w-full disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved && !busy ? "Saved" : "Save details"}
      </button>
    </div>
  );
}