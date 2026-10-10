import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { CURATED_TAGS, CURATED_BRANDS } from "@/lib/revex";
import { Loader2, Check, Plus } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandInput, setBrandInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const toggle = (value, list, setter) => {
    const key = value.toLowerCase();
    const exists = list.some((v) => v.toLowerCase() === key);
    setter(exists ? list.filter((v) => v.toLowerCase() !== key) : [...list, value]);
  };

  const addCustomBrand = () => {
    const v = brandInput.trim();
    if (!v) return;
    if (brands.some((b) => b.toLowerCase() === v.toLowerCase())) {
      setBrandInput("");
      return;
    }
    setBrands([...brands, v]);
    setBrandInput("");
  };

  const canSubmit = styles.length > 0 && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    setSubmitError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again to finish setting up your account.");
      const { data: profile, error } = await supabase
        .from("profiles")
        .update({ style_preferences: styles, favorite_brands: brands })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw new Error("We couldn't save your preferences. Please try again.");
      navigate("/");
    } catch (e) {
      console.error(e);
      setSubmitError(e.message || "Couldn't finish setting up your account. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      <header className="px-5 pt-10 pb-6 border-b-[3px] border-white/10">
        <p className="acid-label text-white/50 mb-1">Welcome to Revex</p>
        <h1 className="font-display text-4xl uppercase leading-[0.95]">Tell us your vibe</h1>
        <p className="text-sm text-white/60 mt-2 font-body">Pick what you're into so we can fill your feed with posts you'll actually love.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-32 no-scrollbar">

        {/* Styles */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl uppercase">Pick your styles</h2>
            <span className="text-[10px] font-heading uppercase text-white/40">{styles.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CURATED_TAGS.map((tag) => {
              const active = styles.some((s) => s.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  key={tag}
                  onClick={() => toggle(tag, styles, setStyles)}
                  className={`acid-chip transition-transform active:scale-95 ${
                    active ? "bg-brand-red text-white border-white" : "bg-white/5 text-white border-white/20"
                  }`}
                >
                  {active && <Check className="w-3 h-3" />} {tag}
                </button>
              );
            })}
          </div>
        </section>

        {/* Brands */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl uppercase">Favorite brands</h2>
            <span className="text-[10px] font-heading uppercase text-white/40">{brands.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CURATED_BRANDS.map((brand) => {
              const active = brands.some((b) => b.toLowerCase() === brand.toLowerCase());
              return (
                <button
                  key={brand}
                  onClick={() => toggle(brand, brands, setBrands)}
                  className={`acid-chip transition-transform active:scale-95 ${
                    active ? "bg-brand-red text-white border-white" : "bg-white/5 text-white border-white/20"
                  }`}
                >
                  {active && <Check className="w-3 h-3" />} {brand}
                </button>
              );
            })}
          </div>

          {/* Custom brand input */}
          <div className="mt-3 flex gap-2">
            <input
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomBrand(); } }}
              placeholder="Add a brand..."
              className="flex-1 bg-white/5 border-2 border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-red"
            />
            <button onClick={addCustomBrand} className="acid-chip bg-white/10 text-white border-white/20 active:scale-95">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {brands.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {brands.filter((b) => !CURATED_BRANDS.some((c) => c.toLowerCase() === b.toLowerCase())).map((b) => (
                <button key={b} onClick={() => setBrands(brands.filter((x) => x !== b))} className="acid-chip bg-brand-red text-white border-white">
                  <Check className="w-3 h-3" /> {b}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 inset-x-0 bg-black border-t-[3px] border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto">
          {submitError && <p role="alert" className="text-center text-sm text-red-400 mb-2">{submitError}</p>}
          <p className="text-center text-[10px] font-heading uppercase text-white/40 mb-2">
            {styles.length > 0 ? "Looking good!" : "Pick at least one style to continue"}
          </p>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="acid-btn bg-brand-red text-white border-white w-full h-12 disabled:opacity-40 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:shadow-brutal"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter Revex"}
          </button>
        </div>
      </div>
    </div>
  );
}
