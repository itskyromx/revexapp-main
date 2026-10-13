# Project instructions

## Project context

This is the Revex web application. Keep changes focused on the user's request and preserve the existing React, Vite, Supabase, and Cloudflare conventions.

## Key files

- `src/`: frontend application source.
- `src/api/supabaseClient.js`: Supabase client and storage helpers.
- `supabase/`: database migrations and Supabase configuration.
- `vite.config.js`: Vite and Cloudflare plugin configuration.
- `.env.local`: local-only environment values; never commit secrets.

## Working notes

- Use the existing Supabase client for authentication, data, storage, and Edge Function calls.
- Use `npm run dev` for local frontend development and the existing Cloudflare workflow for deployment.
- Run the relevant checks from `package.json` before finishing code changes.

## Privacy and data collection

- Keep `src/lib/dataCollection.js` and `src/pages/CookiesPolicy.jsx` aligned with browser storage, analytics, external resources, payment/auth providers, and any service receiving user or device data.
- Before releasing a feature that adds collection or a processor, disclose the data and purpose, apply the appropriate consent category and gating where optional, and increment `COOKIE_POLICY_VERSION` in `src/lib/cookieConsent.js` when the notice or choices change.
- Verify that optional third-party resources do not load before consent and users can reopen cookie settings from the policy page.
