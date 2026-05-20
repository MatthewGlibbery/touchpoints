import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const INVITE_EMAIL_HTML = (args: {
  inviterEmail: string;
  blueprintName: string;
  appUrl: string;
}) => `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#F5F6F8;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:10px;">
                      <div style="width:36px;height:36px;background-color:#F97316;border-radius:8px;color:#FFFFFF;font-size:18px;font-weight:700;line-height:36px;text-align:center;">T</div>
                    </td>
                    <td style="font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">Touchpoints</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.4px;">You've been invited to collaborate</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#475569;">
                  <strong>${escapeHtml(args.inviterEmail)}</strong> invited you to comment on the blueprint
                  <strong>${escapeHtml(args.blueprintName)}</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                  Sign in with this email address to access the blueprint and join the conversation.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;" align="center">
                <a href="${escapeHtml(args.appUrl)}" style="display:inline-block;padding:12px 22px;background-color:#F97316;border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">
                  Open Touchpoints
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94A3B8;">
                  Didn't expect this invitation? You can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#94A3B8;">
            Touchpoints · Service Blueprinting
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendInviteEmail(args: {
  to: string;
  inviterEmail: string;
  blueprintName: string;
  appUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !fromEmail) {
    console.warn('[invite-collaborator] RESEND_API_KEY / RESEND_FROM_EMAIL not set — skipping email');
    return { ok: false, error: 'Email not configured' };
  }
  const subject = `${args.inviterEmail} invited you to "${args.blueprintName}" on Touchpoints`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [args.to],
      subject,
      html: INVITE_EMAIL_HTML(args),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[invite-collaborator] Resend error:', res.status, body);
    return { ok: false, error: `Email send failed (${res.status})` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, error: 'No authorization header' }, 401);
  }

  // Authed client (uses caller's JWT) — confirms the user is logged in and
  // can be the inviter.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let payload: { blueprintRowId?: string; email?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const { blueprintRowId, email } = payload;
  if (!blueprintRowId || !email) {
    return json({ ok: false, error: 'Missing blueprintRowId or email' }, 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json({ ok: false, error: 'Invalid email address' }, 400);
  }

  // Service-role client — used to verify ownership and insert the collaborator
  // row. Ownership check is performed explicitly here (instead of relying on
  // RLS via the user JWT) so the trigger reconcile can run with definer rights.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify caller owns the blueprint
  const { data: bp, error: bpError } = await admin
    .from('blueprints')
    .select('id, owner_id, data')
    .eq('id', blueprintRowId)
    .maybeSingle();

  if (bpError || !bp) {
    return json({ ok: false, error: 'Blueprint not found' }, 404);
  }
  if (bp.owner_id !== user.id) {
    return json({ ok: false, error: 'Not authorized for this blueprint' }, 403);
  }

  // Don't invite the owner themselves
  if (normalizedEmail === (user.email ?? '').toLowerCase()) {
    return json({ ok: false, error: 'You already own this blueprint' }, 400);
  }

  // Look up an existing auth user by email so we can backfill user_id +
  // accepted_at on insert. We page through admin.listUsers up to 1000 because
  // GoTrue v2 doesn't expose a getUserByEmail endpoint.
  let existingUserId: string | null = null;
  try {
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = usersPage?.users?.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail);
    if (match) existingUserId = match.id;
  } catch (e) {
    console.warn('[invite-collaborator] listUsers failed:', e);
  }

  // Insert (or no-op if already exists). The unique key is (blueprint_id, email).
  const insertRow = {
    blueprint_id: blueprintRowId,
    email: normalizedEmail,
    invited_by: user.id,
    user_id: existingUserId,
    accepted_at: existingUserId ? new Date().toISOString() : null,
  };
  const { data: collabRows, error: insertError } = await admin
    .from('blueprint_collaborators')
    .upsert(insertRow, { onConflict: 'blueprint_id,email', ignoreDuplicates: false })
    .select('*');

  if (insertError) {
    console.error('[invite-collaborator] insert error:', insertError);
    return json({ ok: false, error: insertError.message }, 500);
  }

  // Fire the email best-effort (don't fail the request if it fails)
  const blueprintName: string =
    (bp.data as { name?: string })?.name?.trim() || 'Untitled blueprint';
  const origin = req.headers.get('origin') ?? Deno.env.get('APP_URL') ?? '';
  const appUrl = origin
    ? `${origin}/?b=${blueprintRowId}`
    : `https://touchpoints.example.com/?b=${blueprintRowId}`;

  const emailResult = await sendInviteEmail({
    to: normalizedEmail,
    inviterEmail: user.email ?? 'A collaborator',
    blueprintName,
    appUrl,
  });

  return json({
    ok: true,
    collaborator: collabRows?.[0] ?? null,
    emailSent: emailResult.ok,
    emailWarning: emailResult.ok ? undefined : emailResult.error,
  });
});
