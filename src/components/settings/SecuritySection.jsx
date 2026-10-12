import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Check, Loader2 } from "lucide-react";
import { toDate } from "@/lib/revex";
import DeleteAccountCard from "@/components/settings/DeleteAccountCard";

export default function SecuritySection({ user }) {
  const [authUser, setAuthUser] = useState(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active && !error) setAuthUser(data?.user || null);
    });
    return () => { active = false; };
  }, []);

  const joined = toDate(user?.created_at);
  const provider = authUser?.app_metadata?.provider || authUser?.provider || user?.auth_provider || user?.provider;
  const providers = authUser?.app_metadata?.providers || [];
  const identities = authUser?.identities || [];
  const googleAccount = provider === "google"
    || providers.includes("google")
    || identities.some((identity) => identity.provider === "google");
  const signInMethod = googleAccount
    ? "Google Authentication"
    : provider && provider !== "email"
      ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Authentication`
      : "Email & password";
  const signInRows = [
    ["Email", user?.email || "—"],
    ["Sign-in method", signInMethod],
    [
      "Member since",
      joined ? joined.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—",
    ],
  ];

  const changePassword = async () => {
    setError("");
    setDone(false);
    if (next.length < 6) {
      setError("Your new password needs at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // Supabase has no "verify old password" call, so we re-authenticate
      // with it first — a wrong current password fails right here.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email, password: current,
      });
      if (signInError) throw new Error("Your current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(e?.message || "Couldn't change your password. Check your current password and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="acid-card-sm p-3 space-y-2">
        {signInRows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="acid-label shrink-0">{label}</span>
            <span className="text-sm truncate">{value}</span>
          </div>
        ))}
      </div>

      <div className="acid-card p-4 space-y-3">
        <span className="font-heading font-bold uppercase text-sm block">Change password</span>
        <input
          type="password"
          className="acid-input"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          type="password"
          className="acid-input"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          type="password"
          className="acid-input"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-xs text-brand-red">{error}</p>}
        <button
          onClick={changePassword}
          disabled={busy || !current || !next || !confirm}
          className="acid-btn bg-brand-red text-white w-full disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4" /> : null}
          {done && !busy ? "Password updated" : "Update password"}
        </button>
      </div>

      <DeleteAccountCard />
    </div>
  );
}
