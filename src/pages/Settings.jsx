import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, IdCard, Lock, Ban, ShieldCheck, Wallet } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useCurrentUser();
  const [open, setOpen] = useState(null);
  const section = SECTIONS.find((s) => s.key === open);

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
          SECTIONS.map((s) => (
            <SettingsRow key={s.key} icon={s.icon} label={s.label} hint={s.hint} onClick={() => setOpen(s.key)} />
          ))
        ) : (
          <>
            {open === "profile" && <ProfileSection user={user} setUser={setUser} />}
            {open === "details" && <PersonalDetailsSection user={user} setUser={setUser} />}
            {open === "privacy" && <PrivacySection user={user} setUser={setUser} />}
            {open === "blocked" && <BlockedUsersSection />}
            {open === "security" && <SecuritySection user={user} />}
            {open === "payments" && <PaymentsSection user={user} />}
          </>
        )}
      </div>
    </div>
  );
}