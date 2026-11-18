# Resend delivery for Supabase Auth

The signup flow uses Supabase Auth's six-digit email OTP. Keep Auth responsible for creating and verifying codes; send its email through Resend SMTP. Do not call Resend from the browser or expose a Resend API key in a `VITE_` variable.

## Configure delivery

1. In Resend, verify the sending domain `revexxapp.com` and ensure it is enabled for sending. The published template uses `team@revexxapp.com` as its sender.
2. In Resend, create an API key with the minimum permission needed for SMTP sending. Treat it as a secret.
3. In Supabase Dashboard, open **Project Settings → Authentication → SMTP Settings** and enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (STARTTLS)
   - Username: `resend`
   - Password: the Resend API key
   - Sender email: `team@revexxapp.com`
   - Sender name: `Revex`
4. In **Authentication → Email Templates → Confirm signup**, use the published Resend template's branded layout and replace its `{{{TOKEN}}}` placeholder with Supabase's `{{ .Token }}`. Supabase Auth templates are configured in Supabase; publishing a Resend template does not automatically attach it to Auth SMTP.
5. Keep **Confirm email** enabled. Signup and resend confirmation continue to use Supabase Auth's existing OTP flow.

## Published Resend template

The template is available in Resend as `confirm-your-email-address-template` and expects a `TOKEN` value when sent through Resend's template API. The app's signup flow does not send through that API: Supabase Auth generates the code and submits the message to the configured SMTP server. The matching template in Supabase must therefore use `{{ .Token }}`.

The logo is served from `https://revexxapp.com/revex_logo.png`; deploy the repository's `public/revex_logo.png` asset to that site for email clients to load it.
