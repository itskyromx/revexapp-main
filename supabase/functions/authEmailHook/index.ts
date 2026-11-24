import { Webhook } from 'npm:standardwebhooks@1.0.0';

type AuthEmailPayload = {
  user: {
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    old_email?: string;
    provider?: string;
    factor_type?: string;
  };
};

const TEMPLATE_ENV_BY_ACTION: Record<string, string> = {
  signup: 'RESEND_TEMPLATE_SIGNUP',
  email: 'RESEND_TEMPLATE_EMAIL_OTP',
  invite: 'RESEND_TEMPLATE_INVITE',
  magiclink: 'RESEND_TEMPLATE_MAGIC_LINK',
  recovery: 'RESEND_TEMPLATE_RECOVERY',
  email_change: 'RESEND_TEMPLATE_EMAIL_CHANGE',
  reauthentication: 'RESEND_TEMPLATE_REAUTHENTICATION',
  password_changed_notification: 'RESEND_TEMPLATE_PASSWORD_CHANGED',
  email_changed_notification: 'RESEND_TEMPLATE_EMAIL_CHANGED',
  phone_changed_notification: 'RESEND_TEMPLATE_PHONE_CHANGED',
  identity_linked_notification: 'RESEND_TEMPLATE_IDENTITY_LINKED',
  identity_unlinked_notification: 'RESEND_TEMPLATE_IDENTITY_UNLINKED',
  mfa_factor_enrolled_notification: 'RESEND_TEMPLATE_MFA_ENROLLED',
  mfa_factor_unenrolled_notification: 'RESEND_TEMPLATE_MFA_UNENROLLED',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authLink(siteUrl: string, tokenHash: string, action: string, redirectTo: string) {
  const url = new URL('/auth/v1/verify', siteUrl);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', action);
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

async function sendTemplate(to: string, templateId: string, variables: Record<string, string>) {
  if (!to) throw new Error('Auth hook payload did not include an email recipient');
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Revex <support@revexxapp.com>',
      to: [to],
      template: { id: templateId, variables },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend rejected the transactional email (${response.status}): ${details}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  if (!hookSecret) return json({ error: 'Send Email Hook secret is not configured' }, 500);

  let payload: AuthEmailPayload;
  try {
    const secret = hookSecret.replace(/^v1,whsec_/, '');
    const webhook = new Webhook(secret);
    payload = webhook.verify(await request.text(), Object.fromEntries(request.headers)) as AuthEmailPayload;
  } catch (error) {
    console.error('Auth email hook signature verification failed:', error?.message || error);
    return json({ error: 'Invalid hook signature' }, 401);
  }

  const { user, email_data: emailData } = payload;
  const action = emailData?.email_action_type;
  const templateEnv = TEMPLATE_ENV_BY_ACTION[action];
  const templateId = (templateEnv && Deno.env.get(templateEnv)) || Deno.env.get('RESEND_AUTH_TEMPLATE_ID');
  if (!templateEnv || !templateId) {
    console.error(`No Resend template configured for auth email action: ${action}`);
    return json({ error: `No Resend template configured for auth email action: ${action}` }, 500);
  }

  const siteUrl = emailData.site_url || '';
  const redirectTo = emailData.redirect_to || siteUrl;
  const commonVariables = {
    ACTION_TYPE: action,
    EMAIL: user.email || '',
    NEW_EMAIL: user.new_email || '',
    OLD_EMAIL: emailData.old_email || '',
    TOKEN: emailData.token || '',
    TOKEN_HASH: emailData.token_hash || '',
    TOKEN_NEW: emailData.token_new || '',
    TOKEN_HASH_NEW: emailData.token_hash_new || '',
    REDIRECT_TO: redirectTo,
    SITE_URL: siteUrl,
    USERNAME: String(user.user_metadata?.username || user.user_metadata?.display_name || ''),
    PROVIDER: emailData.provider || '',
    FACTOR_TYPE: emailData.factor_type || '',
    CONFIRMATION_URL: emailData.token_hash
      ? authLink(siteUrl, emailData.token_hash, action, redirectTo)
      : '',
    CONFIRMATION_URL_NEW: emailData.token_hash_new
      ? authLink(siteUrl, emailData.token_hash_new, action, redirectTo)
      : '',
    CURRENT_EMAIL_CONFIRMATION_URL: emailData.token_hash_new
      ? authLink(siteUrl, emailData.token_hash_new, action, redirectTo)
      : '',
    NEW_EMAIL_CONFIRMATION_URL: emailData.token_hash
      ? authLink(siteUrl, emailData.token_hash, action, redirectTo)
      : '',
  };

  try {
    if (action === 'email_change' && user.new_email && emailData.token_hash_new) {
      await sendTemplate(user.email || '', templateId, {
        ...commonVariables,
        EMAIL: user.email || '',
        NEW_EMAIL: user.new_email,
        TOKEN: emailData.token || '',
        TOKEN_HASH: emailData.token_hash_new,
        CONFIRMATION_URL: authLink(siteUrl, emailData.token_hash_new, action, redirectTo),
      });
    }

    const recipient = action === 'email_change' ? user.new_email || user.email : user.email;
    const tokenHash = action === 'email_change' ? emailData.token_hash || emailData.token_hash_new : emailData.token_hash;
    await sendTemplate(recipient || '', templateId, {
      ...commonVariables,
      EMAIL: recipient || '',
      TOKEN: action === 'email_change' ? emailData.token_new || emailData.token || '' : emailData.token || '',
      TOKEN_HASH: tokenHash || '',
      CONFIRMATION_URL: tokenHash ? authLink(siteUrl, tokenHash, action, redirectTo) : '',
    });
    return json({});
  } catch (error) {
    console.error('Auth transactional email delivery failed:', error?.message || error);
    return json({ error: 'Transactional email could not be sent' }, 500);
  }
});
