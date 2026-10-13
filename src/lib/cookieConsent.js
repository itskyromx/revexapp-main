export const COOKIE_POLICY_VERSION = "2026-10-13-5";
export const COOKIE_CONSENT_STORAGE_KEY = "revex-cookie-consent";
export const COOKIE_CONSENT_EVENT = "revex:cookie-consent-changed";
export const OPEN_COOKIE_SETTINGS_EVENT = "revex:open-cookie-settings";

export const DEFAULT_COOKIE_CATEGORIES = {
  essential: true,
  preferences: false,
  analytics: false,
  personalization: false,
};

export function readCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || "null");
    if (saved?.policyVersion !== COOKIE_POLICY_VERSION || !saved?.categories) return null;
    return {
      ...saved,
      categories: { ...DEFAULT_COOKIE_CATEGORIES, ...saved.categories, essential: true },
    };
  } catch {
    return null;
  }
}

export function hasCookieConsent(category) {
  if (category === "essential") return true;
  return Boolean(readCookieConsent()?.categories?.[category]);
}

function clearOptionalStorage() {
  try {
    ["theme", "revex-language", "revex_liked", "revex_saved", "revex-viewed-posts"].forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {}
  try {
    window.sessionStorage.removeItem("revex_feed_index");
  } catch {}
  try {
    document.cookie = "sidebar_state=; path=/; max-age=0; SameSite=Lax";
  } catch {}
}

export function saveCookieConsent(categories) {
  const consent = {
    policyVersion: COOKIE_POLICY_VERSION,
    savedAt: new Date().toISOString(),
    categories: {
      essential: true,
      preferences: Boolean(categories?.preferences),
      analytics: Boolean(categories?.analytics),
      personalization: Boolean(categories?.personalization),
    },
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch (error) {
    console.error("Couldn't save cookie preferences:", error);
  }

  if (!consent.categories.preferences) clearOptionalStorage();
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }));
  return consent;
}

export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
