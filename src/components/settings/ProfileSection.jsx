import { useState } from "react";
import { useTheme } from "next-themes";
import { supabase, uploadPublicFile } from "@/api/supabaseClient";
import { Check, Loader2, Monitor, Moon, Sun, Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
import { displayName } from "@/lib/revex";
import { isUsernameAvailable, isValidUsername, normalizeUsername } from "@/lib/usernames";
import { useI18n } from "@/lib/i18n";

export default function ProfileSection({ user, setUser }) {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [name, setName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const useDeviceTheme = () => {
    setTheme("system");
  };

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
    setError("");
    setSaved(false);
    const username = normalizeUsername(name);
    if (!isValidUsername(username)) {
      setError(t("Username must be 3–20 characters, using letters, numbers, and underscores."));
      return;
    }
    setBusy(true);
    const label = username;
    try {
      if (!await isUsernameAvailable(supabase, username, user.id)) {
        throw new Error("That username is already taken. Choose another one.");
      }
      const { error } = await supabase.from('profiles')
        .update({ display_name: username, bio: bio.trim(), avatar }).eq('id', user.id);
      if (error) throw error;
      // keep the name on already published posts and listings in sync
      await supabase.from('posts')
        .update({ creator_name: label, creator_avatar: avatar }).eq('created_by_id', user.id)
        .then(() => {});
      await supabase.from('items')
        .update({ seller_name: label, seller_avatar: avatar }).eq('created_by_id', user.id)
        .then(() => {});
      setName(username);
      setUser({ ...user, display_name: username, bio: bio.trim(), avatar });
      setSaved(true);
    } catch (e) {
      setError(t(e.message || "Couldn't save your profile."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="acid-card p-4 flex items-center gap-4">
        <Avatar name={name || displayName(user)} src={avatar} size={64} />
        <label className="acid-btn bg-card text-foreground text-xs cursor-pointer">
          <Upload className="w-4 h-4" /> {t("Change photo")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && pickAvatar(e.target.files[0])}
          />
        </label>
      </div>

      <div>
        <label htmlFor="profile-username" className="acid-label">{t("Username")}</label>
        <input
          id="profile-username"
          className="acid-input mt-1"
          placeholder="your_username"
          value={name}
          onChange={(e) => setName(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "").slice(0, 20))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={20}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          {t("Your unique name across Revex, shown on your profile, posts, listings and chats.")}
        </p>
      </div>

      <div>
        <span className="acid-label">{t("Bio")}</span>
        <textarea
          rows={3}
          maxLength={200}
          className="acid-input mt-1 resize-none"
          placeholder={t("Tell people what you're into…")}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="w-full flex items-center justify-between py-3 border-2 border-border px-3">
        <span className="flex items-center gap-2">
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span className="font-heading font-bold uppercase text-sm">{t("Dark mode")}</span>
        </span>
        <span
          className={`w-12 h-7 rounded-full border-2 border-border flex items-center transition-colors px-0.5 ${
            isDark ? "bg-brand-red justify-end" : "bg-muted justify-start"
          }`}>
          <span className="w-5 h-5 rounded-full bg-card" />
        </span>
      </button>

      <button
        type="button"
        onClick={useDeviceTheme}
        className="w-full flex items-center gap-2 border-2 border-border px-3 py-2 text-left text-xs font-bold uppercase"
      >
        <Monitor className="w-4 h-4" />
        {t("Use device theme")}
      </button>

      {error && <p className="text-xs text-brand-red">{error}</p>}

      <button onClick={save} disabled={busy} className="acid-btn bg-brand-red text-white w-full disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved && !busy ? t("Saved") : t("Save profile")}
      </button>
    </div>
  );
}
