import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { COOKIE_CONSENT_EVENT, hasCookieConsent } from "@/lib/cookieConsent";

export default function CookieAwareThemeProvider({ children }) {
  const [allowPreferences, setAllowPreferences] = useState(() => hasCookieConsent("preferences"));

  useEffect(() => {
    const update = () => setAllowPreferences(hasCookieConsent("preferences"));
    window.addEventListener(COOKIE_CONSENT_EVENT, update);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, update);
  }, []);

  return (
    <ThemeProvider
      key={allowPreferences ? "theme-preferences-enabled" : "theme-preferences-disabled"}
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={allowPreferences ? "theme" : "revex-theme-essential-only"}
    >
      {children}
    </ThemeProvider>
  );
}
