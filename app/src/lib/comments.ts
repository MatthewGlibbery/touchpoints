import { supabase } from './supabase';
import type {
  Comment,
  CommentAnchor,
  CommentReaction,
  CommentReactionEmoji,
  CommentMention,
  Collaborator,
  Notification,
} from '../types/blueprint';

// ─── Row → app type mappers ──────────────────────────────────────────────────

export type CommentRow = {
  id: string;
  blueprint_id: string;
  anchor_type: string;
  anchor_id: string;
  parent_comment_id: string | null;
  author_user_id: string;
  author_name: string;
  author_email: string;
  body: string;
  mentions: CommentMention[] | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    anchor: { type: row.anchor_type as CommentAnchor['type'], id: row.anchor_id },
    parentCommentId: row.parent_comment_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    body: row.body,
    mentions: row.mentions ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by,
  };
}

export type ReactionRow = {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export function rowToReaction(row: ReactionRow): CommentReaction {
  return {
    id: row.id,
    commentId: row.comment_id,
    userId: row.user_id,
    emoji: row.emoji as CommentReactionEmoji,
    createdAt: row.created_at,
  };
}

type CollabRow = {
  id: string;
  blueprint_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
};

function rowToCollaborator(row: CollabRow): Collaborator {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    userId: row.user_id,
    email: row.email,
    name: row.name ?? null,
    invitedByUserId: row.invited_by,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}

type NotificationRow = {
  id: string;
  user_id: string;
  blueprint_id: string;
  comment_id: string | null;
  kind: 'mention' | 'reply' | 'reaction';
  snippet: string;
  actor_name: string;
  read_at: string | null;
  created_at: string;
};

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    blueprintId: row.blueprint_id,
    commentId: row.comment_id,
    kind: row.kind,
    snippet: row.snippet,
    actorName: row.actor_name,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// ─── Comments CRUD ───────────────────────────────────────────────────────────

export async function fetchComments(blueprintRowId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('blueprint_id', blueprintRowId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[comments] fetchComments:', error);
    return [];
  }
  return (data as CommentRow[]).map(rowToComment);
}

export async function fetchReactions(blueprintRowId: string): Promise<CommentReaction[]> {
  // Two-step: get comment ids for blueprint, then their reactions.
  const { data: cs } = await supabase
    .from('comments')
    .select('id')
    .eq('blueprint_id', blueprintRowId);
  const ids = (cs ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('*')
    .in('comment_id', ids);
  if (error) {
    console.error('[comments] fetchReactions:', error);
    return [];
  }
  return (data as ReactionRow[]).map(rowToReaction);
}

export type NewCommentInput = {
  blueprintRowId: string;
  anchor: CommentAnchor;
  parentCommentId: string | null;
  authorUserId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  mentions: CommentMention[];
};

export async function insertComment(input: NewCommentInput): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      blueprint_id: input.blueprintRowId,
      anchor_type: input.anchor.type,
      anchor_id: input.anchor.id,
      parent_comment_id: input.parentCommentId,
      author_user_id: input.authorUserId,
      author_name: input.authorName,
      author_email: input.authorEmail,
      body: input.body,
      mentions: input.mentions,
    })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[comments] insertComment:', error);
    return null;
  }
  return rowToComment(data as CommentRow);
}

export async function updateCommentBody(
  commentId: string,
  body: string,
  mentions: CommentMention[],
): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ body, mentions, updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) console.error('[comments] updateCommentBody:', error);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) console.error('[comments] deleteComment:', error);
}

export async function updateCommentAnchor(
  rootCommentId: string,
  anchor: CommentAnchor,
): Promise<void> {
  // Update both the root and all replies so the entire thread re-attaches.
  // Replies are looked up by parentCommentId, but we keep their anchor in sync
  // for consistency with detached-thread detection.
  const ids = [rootCommentId];
  const { data: replies } = await supabase
    .from('comments')
    .select('id')
    .eq('parent_comment_id', rootCommentId);
  for (const r of (replies ?? []) as Array<{ id: string }>) ids.push(r.id);
  const { error } = await supabase
    .from('comments')
    .update({
      anchor_type: anchor.type,
      anchor_id: anchor.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);
  if (error) console.error('[comments] updateCommentAnchor:', error);
}

export async function setThreadResolved(
  rootCommentId: string,
  resolvedByUserId: string | null,
): Promise<{ resolvedAt: string | null; resolvedByUserId: string | null } | null> {
  const resolvedAt = resolvedByUserId ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from('comments')
    .update({ resolved_at: resolvedAt, resolved_by: resolvedByUserId })
    .eq('id', rootCommentId)
    .select('resolved_at, resolved_by')
    .single();
  if (error) {
    console.error('[comments] setThreadResolved:', error);
    return null;
  }
  return {
    resolvedAt: (data as { resolved_at: string | null }).resolved_at,
    resolvedByUserId: (data as { resolved_by: string | null }).resolved_by,
  };
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function insertReaction(
  commentId: string,
  userId: string,
  emoji: CommentReactionEmoji,
): Promise<CommentReaction | null> {
  const { data, error } = await supabase
    .from('comment_reactions')
    .insert({ comment_id: commentId, user_id: userId, emoji })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[comments] insertReaction:', error);
    return null;
  }
  return rowToReaction(data as ReactionRow);
}

export async function deleteReaction(
  commentId: string,
  userId: string,
  emoji: CommentReactionEmoji,
): Promise<void> {
  const { error } = await supabase
    .from('comment_reactions')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error) console.error('[comments] deleteReaction:', error);
}

// ─── Collaborators ───────────────────────────────────────────────────────────

export async function fetchCollaborators(blueprintRowId: string): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('blueprint_collaborators')
    .select('*')
    .eq('blueprint_id', blueprintRowId)
    .order('invited_at', { ascending: true });
  if (error) {
    console.error('[comments] fetchCollaborators:', error);
    return [];
  }
  return (data as CollabRow[]).map(rowToCollaborator);
}

export async function inviteCollaboratorViaEdge(
  blueprintRowId: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('invite-collaborator', {
      body: { blueprintRowId, email },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if ((data as { ok?: boolean })?.ok === false) {
      return { ok: false, error: (data as { error?: string }).error };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeCollaborator(collaboratorId: string): Promise<void> {
  const { error } = await supabase
    .from('blueprint_collaborators')
    .delete()
    .eq('id', collaboratorId);
  if (error) console.error('[comments] removeCollaborator:', error);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[comments] fetchNotifications:', error);
    return [];
  }
  return (data as NotificationRow[]).map(rowToNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) console.error('[comments] markNotificationRead:', error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) console.error('[comments] markAllNotificationsRead:', error);
}

// ─── Notify edge function (post-write trigger) ───────────────────────────────

export async function triggerNotifyComment(payload: {
  commentId?: string;
  reactionId?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('notify-comment', { body: payload });
  } catch (e) {
    console.error('[comments] triggerNotifyComment:', e);
  }
}
