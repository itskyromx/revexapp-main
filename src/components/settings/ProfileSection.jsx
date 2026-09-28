import { useState } from "react";
import { useTheme } from "next-themes";
import { supabase, uploadPublicFile } from "@/api/supabaseClient";
import { Check, Loader2, Moon, Sun, Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
import { displayName } from "@/lib/styld";

export default function ProfileSection({ user, setUser }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [name, setName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const pickAvatar = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { file_url } = await uploadPublicFile(file, "avatars");
      setAvatar(file_url);
    } catch (e) {
      setError(e.message || "Couldn't upload that photo.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    const label = name.trim() || displayName(user);
    try {
      const { error } = await supabase.from('profiles')
        .update({ display_name: name.trim(), bio: bio.trim(), avatar }).eq('id', user.id);
      if (error) throw error;
      // keep the name on already published posts and listings in sync
      await supabase.from('posts')
        .update({ creator_name: label, creator_avatar: avatar }).eq('created_by_id', user.id)
        .then(() => {});
      await supabase.from('items')
        .update({ seller_name: label, seller_avatar: avatar }).eq('created_by_id', user.id)
        .then(() => {});
      setUser({ ...user, display_name: name.trim(), bio: bio.trim(), avatar });
      setSaved(true);
    } catch (e) {
      setError(e.message || "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="acid-card p-4 flex items-center gap-4">
        <Avatar name={name || displayName(user)} src={avatar} size={64} />
        <label className="acid-btn bg-card text-foreground text-xs cursor-pointer">
          <Upload className="w-4 h-4" /> Change photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && pickAvatar(e.target.files[0])}
          />
        </label>
      </div>

      <div>
        <span className="acid-label">Display name</span>
        <input
          className="acid-input mt-1"
          placeholder={user?.full_name || "Your name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Shown on your profile, posts, listings and chats.
        </p>
      </div>

      <div>
        <span className="acid-label">Bio</span>
        <textarea
          rows={3}
          maxLength={200}
          className="acid-input mt-1 resize-none"
          placeholder="Tell people what you're into…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="w-full flex items-center justify-between py-3 border-2 border-border px-3">
        <span className="flex items-center gap-2">
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span className="font-heading font-bold uppercase text-sm">Dark mode</span>
        </span>
        <span
          className={`w-12 h-7 rounded-full border-2 border-border flex items-center transition-colors px-0.5 ${
            isDark ? "bg-brand-red justify-end" : "bg-muted justify-start"
          }`}>
          <span className="w-5 h-5 rounded-full bg-card" />
        </span>
      </button>

      {error && <p className="text-xs text-brand-red">{error}</p>}

      <button onClick={save} disabled={busy} className="acid-btn bg-brand-red text-white w-full disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved && !busy ? "Saved" : "Save profile"}
      </button>
    </div>
  );
}