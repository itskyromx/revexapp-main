import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COOKIE_CATEGORIES } from "@/lib/dataCollection";
import {
  COOKIE_CONSENT_EVENT,
  DEFAULT_COOKIE_CATEGORIES,
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookieConsent";

export default function CookieConsent() {
  const [consent, setConsent] = useState(() => readCookieConsent());
  const [customizing, setCustomizing] = useState(false);
  const [choices, setChoices] = useState(() => ({
    ...DEFAULT_COOKIE_CATEGORIES,
    ...(readCookieConsent()?.categories || {}),
  }));

  useEffect(() => {
    const handleConsent = (event) => {
      const next = event.detail || readCookieConsent();
      setConsent(next);
      if (next?.categories) setChoices(next.categories);
    };
    const openSettings = () => {
      const saved = readCookieConsent();
      setChoices({ ...DEFAULT_COOKIE_CATEGORIES, ...(saved?.categories || {}) });
      setCustomizing(true);
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    };
  }, []);

  const finish = (categories) => {
    setConsent(saveCookieConsent(categories));
    setCustomizing(false);
  };

  if (consent && !customizing) return null;

  return (
    <aside
      role="dialog"
      aria-label="Cookie and data choices"
      className="fixed inset-x-0 bottom-0 z-[100] border-t-4 border-border bg-card text-foreground shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
    >
      <div className="mx-auto max-h-[85dvh] max-w-5xl overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-display text-lg uppercase">Your data and cookie choices</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Essential services include sign-in, security, the site fonts and QR generation. The QR provider receives the drop-off code when its image is generated. Optional preferences save your theme, sidebar and feed position. Semantic search and recommendations are optional and send product descriptions, searches and selected style/brand preferences to OpenAI.
            </p>
            <Link to="/cookies-policy" className="mt-2 inline-block text-xs font-bold text-primary underline underline-offset-4">
              Read the Cookies Policy and data collection details
            </Link>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-sm sm:justify-end">
            <button onClick={() => finish({ ...DEFAULT_COOKIE_CATEGORIES, preferences: true, analytics: true, personalization: true })} className="acid-btn bg-brand-red px-3 py-2 text-xs text-white">
              Accept all
            </button>
            <button onClick={() => finish(DEFAULT_COOKIE_CATEGORIES)} className="acid-btn bg-muted px-3 py-2 text-xs text-foreground">
              Essential only
            </button>
            {!customizing && (
              <button onClick={() => setCustomizing(true)} className="acid-btn bg-card px-3 py-2 text-xs text-foreground">
                Customize
              </button>
            )}
          </div>
        </div>

        {customizing && (
          <div className="mt-4 border-t-2 border-border/40 pt-4">
            <h2 className="font-heading text-sm font-bold uppercase">Customize categories</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {COOKIE_CATEGORIES.map((category) => (
                <label key={category.key} className="flex items-start gap-3 border-2 border-border/40 p-3">
                  <input
                    type="checkbox"
                    checked={category.required || Boolean(choices[category.key])}
                    disabled={category.required}
                    onChange={(event) => setChoices((current) => ({ ...current, [category.key]: event.target.checked }))}
                    className="mt-1 h-4 w-4 accent-brand-red"
                  />
                  <span>
                    <span className="block text-sm font-bold">{category.title}{category.required ? " · always on" : ""}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">{category.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button onClick={() => setCustomizing(false)} className="acid-btn bg-muted px-3 py-2 text-xs text-foreground">Cancel</button>
              <button onClick={() => finish(choices)} className="acid-btn bg-brand-red px-3 py-2 text-xs text-white">Save my choices</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
