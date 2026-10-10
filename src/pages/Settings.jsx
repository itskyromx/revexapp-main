import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, IdCard, Lock, Ban, ShieldCheck, Wallet, FileText, LogOut, ChevronRight, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/useAuth";
import { toast } from "@/components/ui/use-toast";
import SettingsRow from "@/components/settings/SettingsRow";
import ProfileSection from "@/components/settings/ProfileSection";
import PersonalDetailsSection from "@/components/settings/PersonalDetailsSection";
import PrivacySection from "@/components/settings/PrivacySection";
import BlockedUsersSection from "@/components/settings/BlockedUsersSection";
import SecuritySection from "@/components/settings/SecuritySection";
import PaymentsSection from "@/components/settings/PaymentsSection";

const SECTIONS = [
  { key: "profile", label: "Profile", hint: "Display name, photo and bio", icon: User },
  { key: "details", label: "Personal details", hint: "Phone, address and account info", icon: IdCard },
  { key: "privacy", label: "Privacy", hint: "Visibility and who can message you", icon: Lock },
  { key: "blocked", label: "Blocked users", hint: "People you've blocked", icon: Ban },
  { key: "security", label: "Security", hint: "Password and sign-in", icon: ShieldCheck },
  { key: "payments", label: "Payments", hint: "Seller payouts", icon: Wallet },
  { key: "legal", label: "Legal documents", hint: "Terms and Conditions & Privacy Policy", icon: FileText },
];

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { user, loading, setUser } = useCurrentUser();
  const [open, setOpen] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const section = SECTIONS.find((s) => s.key === open);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout(false);
      toast({ title: "Logged out", description: "You have been logged out of your account." });
      navigate("/", { replace: true });
    } catch (error) {
      console.error(error);
      toast({ title: "Couldn't log out", description: "Please try again." });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => (open ? setOpen(null) : navigate(-1))}
            aria-label="Back"
            className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-display text-lg uppercase">{section ? section.label : "Settings"}</span>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-2">
        {loading ? (
          <div className="h-40 grid place-items-center">
            <div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !open ? (
          <>
            {SECTIONS.map((s) => (
              <SettingsRow key={s.key} icon={s.icon} label={s.label} hint={s.hint} onClick={() => setOpen(s.key)} />
            ))}
            <button onClick={handleLogout} disabled={loggingOut} className="acid-btn bg-muted text-foreground mt-4 w-full disabled:opacity-50">
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </>
        ) : (
          <>
            {open === "profile" && <ProfileSection user={user} setUser={setUser} />}
            {open === "details" && <PersonalDetailsSection user={user} setUser={setUser} />}
            {open === "privacy" && <PrivacySection user={user} setUser={setUser} />}
            {open === "blocked" && <BlockedUsersSection />}
            {open === "security" && <SecuritySection user={user} />}
            {open === "payments" && <PaymentsSection user={user} />}
            {open === "legal" && (
              <div className="space-y-2">
                {[
                  ["Terms and Conditions", "/terms-and-conditions"],
                  ["Privacy Policy", "/privacy-policy"],
                ].map(([label, path]) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="acid-card-sm w-full p-4 flex items-center justify-between text-left font-heading font-bold uppercase text-sm"
                  >
                    {label}
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
