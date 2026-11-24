# Supabase Auth emails through Resend templates

This function handles **Supabase Auth transactional emails only**. In-app activity
and social notifications continue to be written to `public.notifications` and do
not trigger Resend.

## Configure Resend templates

Create and publish templates in the Resend dashboard. Each template used by this
function should define these variables (unused variables can be omitted):

- `ACTION_TYPE`, `EMAIL`, `NEW_EMAIL`, `OLD_EMAIL`, `USERNAME`
- `TOKEN`, `TOKEN_HASH`, `TOKEN_NEW`, `TOKEN_HASH_NEW`
- `REDIRECT_TO`, `SITE_URL`, `CONFIRMATION_URL`, `CONFIRMATION_URL_NEW`,
  `CURRENT_EMAIL_CONFIRMATION_URL`, `NEW_EMAIL_CONFIRMATION_URL`
- `PROVIDER`, `FACTOR_TYPE`

Set the template ID for each action you enable. An action-specific ID falls back
to `RESEND_AUTH_TEMPLATE_ID` when omitted:

| Auth action | Secret containing the Resend template ID |
| --- | --- |
| Signup confirmation | `RESEND_TEMPLATE_SIGNUP` |
| Email OTP | `RESEND_TEMPLATE_EMAIL_OTP` |
| Invitation | `RESEND_TEMPLATE_INVITE` |
| Magic link | `RESEND_TEMPLATE_MAGIC_LINK` |
| Password recovery | `RESEND_TEMPLATE_RECOVERY` |
| Email change | `RESEND_TEMPLATE_EMAIL_CHANGE` |
| Reauthentication | `RESEND_TEMPLATE_REAUTHENTICATION` |
| Password changed | `RESEND_TEMPLATE_PASSWORD_CHANGED` |
| Email changed | `RESEND_TEMPLATE_EMAIL_CHANGED` |
| Phone changed | `RESEND_TEMPLATE_PHONE_CHANGED` |
| Identity linked / unlinked | `RESEND_TEMPLATE_IDENTITY_LINKED` / `RESEND_TEMPLATE_IDENTITY_UNLINKED` |
| MFA enrolled / unenrolled | `RESEND_TEMPLATE_MFA_ENROLLED` / `RESEND_TEMPLATE_MFA_UNENROLLED` |

`CONFIRMATION_URL` is a Supabase `/auth/v1/verify` URL built from the hook's
token hash, action type and redirect URL. The raw OTP is passed separately as
`TOKEN` for templates that display a code. Treat these template variables as
secrets; never log or expose them outside the recipient's email.

## Deploy and connect the hook

1. Set the Edge Function secrets: `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`,
   `RESEND_FROM`, and the template IDs above. Generate the hook secret in the
   Supabase Dashboard under **Authentication → Hooks**. The value has the form
   `v1,whsec_...`.
2. Deploy the endpoint without gateway JWT verification; the function verifies
   Supabase's signed webhook itself:

   ```sh
   supabase functions deploy authEmailHook --no-verify-jwt
   ```

3. In **Authentication → Hooks**, add a **Send Email** hook using HTTPS and the
   URL `https://<project-ref>.supabase.co/functions/v1/authEmailHook`. Save the
   same generated signing secret as `SEND_EMAIL_HOOK_SECRET`.
4. Confirm the Email provider remains enabled in Supabase Auth. The hook replaces
   Supabase's built-in email delivery when enabled.

The function intentionally returns an error when a requested action has no
configured template or Resend rejects the send. Configure every Auth email type
enabled in the project before enabling the hook.
