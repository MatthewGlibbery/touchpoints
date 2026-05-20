import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REACTION_DEBOUNCE_MS = 5 * 60 * 1000;
const SNIPPET_MAX = 240;

type Kind = 'mention' | 'reply' | 'reaction';

type CommentRow = {
  id: string;
  blueprint_id: string;
  anchor_type: string;
  anchor_id: string;
  parent_comment_id: string | null;
  author_user_id: string;
  author_name: string;
  author_email: string;
  body: string;
  mentions: Array<{ userId: string; email?: string; name?: string }> | null;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip `@[name](userId)` tokens to plain `@name` for snippets / display.
function plainBody(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

function makeSnippet(body: string): string {
  const plain = plainBody(body).trim().replace(/\s+/g, ' ');
  if (plain.length <= SNIPPET_MAX) return plain;
  return plain.slice(0, SNIPPET_MAX - 1).trimEnd() + '…';
}

function anchorDescription(
  anchorType: string,
  anchorId: string,
  blueprint: { actors?: Array<{ id: string; name: string }>; phases?: Array<{ id: string; name: string }>; actions?: Array<{ id: string; label: string; phaseId: string }> } | null,
): string {
  if (!blueprint) return `On ${anchorType}`;
  switch (anchorType) {
    case 'action': {
      const a = blueprint.actions?.find((x) => x.id === anchorId);
      const ph = a ? blueprint.phases?.find((p) => p.id === a.phaseId) : null;
      if (!a) return 'On a step';
      return ph ? `On step "${a.label}" (Phase: ${ph.name})` : `On step "${a.label}"`;
    }
    case 'phase': {
      const p = blueprint.phases?.find((x) => x.id === anchorId);
      return p ? `On phase "${p.name}"` : 'On a phase';
    }
    case 'actor': {
      const a = blueprint.actors?.find((x) => x.id === anchorId);
      return a ? `On actor "${a.name}"` : 'On an actor';
    }
    case 'edge': return 'On a connection between steps';
    case 'statusLane': return 'On a status lane';
    case 'statusSegment': return 'On a status lane segment';
    case 'timelineLane': return 'On a timeline lane';
    case 'timelineSegment': return 'On a timeline lane segment';
    default: return `On ${anchorType}`;
  }
}

function emailSubject(
  blueprintName: string,
  actorName: string,
  kind: Kind,
  emoji?: string,
): string {
  const prefix = `[${blueprintName}]`;
  switch (kind) {
    case 'mention':
      return `${prefix} @${actorName} mentioned you`;
    case 'reply':
      return `${prefix} ${actorName} replied to your thread`;
    case 'reaction':
      return `${prefix} ${actorName} reacted ${emoji ?? ''} to your comment`;
  }
}

function kindLabel(kind: Kind, emoji?: string): string {
  switch (kind) {
    case 'mention': return 'mentioned you';
    case 'reply': return 'replied to your thread';
    case 'reaction': return `reacted ${emoji ?? ''} to your comment`;
  }
}

function emailHtml(args: {
  blueprintName: string;
  actorName: string;
  kindLabel: string;
  anchorDesc: string;
  snippetHtml: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#F5F6F8;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F8;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
      <tr><td style="padding:32px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;"><div style="width:36px;height:36px;background-color:#F97316;border-radius:8px;color:#FFFFFF;font-size:18px;font-weight:700;line-height:36px;text-align:center;">T</div></td>
          <td style="font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">Touchpoints</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 32px 4px 32px;">
        <p style="margin:0 0 6px 0;font-size:13px;color:#94A3B8;">${escapeHtml(args.blueprintName)}</p>
        <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.4px;">${escapeHtml(args.actorName)} ${escapeHtml(args.kindLabel)}</h1>
        <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#475569;">${escapeHtml(args.anchorDesc)}</p>
      </td></tr>
      <tr><td style="padding:0 32px 20px 32px;">
        <div style="padding:14px 16px;background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;font-size:14px;line-height:1.55;color:#9A3412;">
          ${args.snippetHtml}
        </div>
      </td></tr>
      <tr><td style="padding:0 32px 28px 32px;" align="center">
        <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;padding:12px 22px;background-color:#F97316;border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">View thread</a>
      </td></tr>
      <tr><td style="padding:0 32px 32px 32px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94A3B8;">
          You're receiving this because you participated in this thread or were @-mentioned. Open the blueprint to manage notifications.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:11px;color:#94A3B8;">Touchpoints · Service Blueprinting</p>
  </td></tr>
</table></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !fromEmail) {
    console.warn('[notify-comment] RESEND env vars missing — skipping email to', to);
    return { ok: false, error: 'Email not configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[notify-comment] Resend', res.status, body);
    return { ok: false, error: `Send failed (${res.status})` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'No authorization' }, 401);

  // Confirm caller is signed in (so anon clients can't spam this function).
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ ok: false, error: 'Unauthorized' }, 401);

  let payload: { commentId?: string; reactionId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const origin = req.headers.get('origin') ?? Deno.env.get('APP_URL') ?? 'https://touchpoints.example.com';

  if (payload.commentId) {
    return await handleComment(admin, payload.commentId, user.id, origin);
  }
  if (payload.reactionId) {
    return await handleReaction(admin, payload.reactionId, user.id, origin);
  }
  return json({ ok: false, error: 'Missing commentId or reactionId' }, 400);
});

type Admin = ReturnType<typeof createClient>;

async function handleComment(
  admin: Admin,
  commentId: string,
  callerUserId: string,
  origin: string,
): Promise<Response> {
  const { data: comment } = await admin
    .from('comments')
    .select('*')
    .eq('id', commentId)
    .maybeSingle();
  if (!comment) return json({ ok: false, error: 'Comment not found' }, 404);
  const c = comment as CommentRow;

  // Defense in depth: only the author can trigger their own notification fan-out.
  if (c.author_user_id !== callerUserId) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  // Fetch blueprint for anchor description + name
  const { data: bpRow } = await admin
    .from('blueprints')
    .select('data')
    .eq('id', c.blueprint_id)
    .maybeSingle();
  const blueprintData = (bpRow?.data ?? null) as
    | { name?: string; actors?: Array<{ id: string; name: string }>; phases?: Array<{ id: string; name: string }>; actions?: Array<{ id: string; label: string; phaseId: string }> }
    | null;
  const blueprintName = blueprintData?.name ?? 'Untitled blueprint';
  const anchorDesc = anchorDescription(c.anchor_type, c.anchor_id, blueprintData);

  // Compute recipient set with kinds.
  // recipients map: userId → kind (mention beats reply when the same user gets both)
  const recipients = new Map<string, Kind>();

  // 1) Mentions
  for (const m of c.mentions ?? []) {
    if (!m.userId) continue;
    if (m.userId === c.author_user_id) continue; // never notify the author of their own comment
    recipients.set(m.userId, 'mention');
  }

  // 2) Replies — include thread root author + distinct other authors in the thread
  if (c.parent_comment_id) {
    const { data: threadComments } = await admin
      .from('comments')
      .select('id, author_user_id')
      .or(`id.eq.${c.parent_comment_id},parent_comment_id.eq.${c.parent_comment_id}`);
    const replyTargets = new Set<string>();
    for (const tc of (threadComments ?? []) as Array<{ author_user_id: string }>) {
      if (tc.author_user_id !== c.author_user_id) replyTargets.add(tc.author_user_id);
    }
    for (const uid of replyTargets) {
      // Don't downgrade a 'mention' to 'reply' for the same recipient
      if (!recipients.has(uid)) recipients.set(uid, 'reply');
    }
  }

  if (recipients.size === 0) {
    return json({ ok: true, notified: 0 });
  }

  // Dedupe — skip recipients who already have a notification row for this comment.
  const recipientIds = Array.from(recipients.keys());
  const { data: existing } = await admin
    .from('notifications')
    .select('user_id')
    .eq('comment_id', commentId)
    .in('user_id', recipientIds);
  const alreadyNotified = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));

  const snippet = makeSnippet(c.body);
  const actorName = c.author_name || c.author_email;

  let notified = 0;
  let emailsSent = 0;
  for (const [recipientId, kind] of recipients) {
    if (alreadyNotified.has(recipientId)) continue;

    // Insert notification row
    const { error: insertError } = await admin.from('notifications').insert({
      user_id: recipientId,
      blueprint_id: c.blueprint_id,
      comment_id: c.id,
      kind,
      snippet,
      actor_name: actorName,
    });
    if (insertError) {
      console.error('[notify-comment] insert failed for', recipientId, insertError);
      continue;
    }
    notified++;

    // Look up recipient email
    const recipientEmail = await getUserEmail(admin, recipientId);
    if (!recipientEmail) continue;

    const ctaUrl = `${origin}/?b=${c.blueprint_id}&comment=${c.id}`;
    const subject = emailSubject(blueprintName, actorName, kind);
    const html = emailHtml({
      blueprintName,
      actorName,
      kindLabel: kindLabel(kind),
      anchorDesc,
      snippetHtml: escapeHtml(snippet),
      ctaUrl,
    });
    const sent = await sendEmail(recipientEmail, subject, html);
    if (sent.ok) emailsSent++;
  }

  return json({ ok: true, notified, emailsSent });
}

async function handleReaction(
  admin: Admin,
  reactionId: string,
  callerUserId: string,
  origin: string,
): Promise<Response> {
  const { data: reaction } = await admin
    .from('comment_reactions')
    .select('*')
    .eq('id', reactionId)
    .maybeSingle();
  if (!reaction) return json({ ok: false, error: 'Reaction not found' }, 404);
  const r = reaction as { id: string; comment_id: string; user_id: string; emoji: string };
  if (r.user_id !== callerUserId) return json({ ok: false, error: 'Forbidden' }, 403);

  const { data: comment } = await admin
    .from('comments')
    .select('*')
    .eq('id', r.comment_id)
    .maybeSingle();
  if (!comment) return json({ ok: false, error: 'Comment not found' }, 404);
  const c = comment as CommentRow;

  // Don't notify the reactor about their own reaction
  if (c.author_user_id === r.user_id) {
    return json({ ok: true, notified: 0, reason: 'self-reaction' });
  }

  // 5-min debounce: skip if a 'reaction' notification exists for
  // (comment_id, recipient_id) within the window.
  const cutoff = new Date(Date.now() - REACTION_DEBOUNCE_MS).toISOString();
  const { data: recent } = await admin
    .from('notifications')
    .select('id')
    .eq('comment_id', c.id)
    .eq('user_id', c.author_user_id)
    .eq('kind', 'reaction')
    .gte('created_at', cutoff)
    .limit(1);
  if (recent && recent.length > 0) {
    return json({ ok: true, notified: 0, reason: 'debounced' });
  }

  // Look up reactor display name + recipient email
  const reactor = await getUserDisplayName(admin, r.user_id);
  const recipientEmail = await getUserEmail(admin, c.author_user_id);
  const actorName = reactor.name ?? reactor.email ?? 'Someone';

  // Fetch blueprint for context
  const { data: bpRow } = await admin
    .from('blueprints')
    .select('data')
    .eq('id', c.blueprint_id)
    .maybeSingle();
  const blueprintData = (bpRow?.data ?? null) as
    | { name?: string; actors?: Array<{ id: string; name: string }>; phases?: Array<{ id: string; name: string }>; actions?: Array<{ id: string; label: string; phaseId: string }> }
    | null;
  const blueprintName = blueprintData?.name ?? 'Untitled blueprint';
  const anchorDesc = anchorDescription(c.anchor_type, c.anchor_id, blueprintData);
  const snippet = makeSnippet(c.body);

  const { error: insertError } = await admin.from('notifications').insert({
    user_id: c.author_user_id,
    blueprint_id: c.blueprint_id,
    comment_id: c.id,
    kind: 'reaction',
    snippet: `${r.emoji} on: ${snippet}`,
    actor_name: actorName,
  });
  if (insertError) {
    console.error('[notify-comment] insert reaction notification failed:', insertError);
    return json({ ok: false, error: insertError.message }, 500);
  }

  if (recipientEmail) {
    const ctaUrl = `${origin}/?b=${c.blueprint_id}&comment=${c.id}`;
    const subject = emailSubject(blueprintName, actorName, 'reaction', r.emoji);
    const html = emailHtml({
      blueprintName,
      actorName,
      kindLabel: kindLabel('reaction', r.emoji),
      anchorDesc,
      snippetHtml: escapeHtml(snippet),
      ctaUrl,
    });
    await sendEmail(recipientEmail, subject, html);
  }

  return json({ ok: true, notified: 1 });
}

async function getUserEmail(admin: Admin, userId: string): Promise<string | null> {
  try {
    // @ts-ignore — admin auth namespace not in the public types but available at runtime
    const { data } = await admin.auth.admin.getUserById(userId);
    return (data?.user?.email as string | undefined) ?? null;
  } catch (e) {
    console.warn('[notify-comment] getUserById failed for', userId, e);
    return null;
  }
}

async function getUserDisplayName(admin: Admin, userId: string): Promise<{ name: string | null; email: string | null }> {
  try {
    // @ts-ignore
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = (data?.user?.email as string | undefined) ?? null;
    const meta = (data?.user?.user_metadata ?? {}) as { display_name?: string };
    const name = (meta.display_name ?? '').trim() || null;
    return { name, email };
  } catch (e) {
    console.warn('[notify-comment] getUserById failed for', userId, e);
    return { name: null, email: null };
  }
}
