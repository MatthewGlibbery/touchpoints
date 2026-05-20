import { create } from 'zustand';
import type {
  Blueprint,
  Comment,
  CommentAnchor,
  CommentReaction,
  CommentReactionEmoji,
  CommentMention,
  Collaborator,
  Notification,
} from '../types/blueprint';
import {
  fetchComments,
  fetchReactions,
  fetchCollaborators,
  fetchNotifications,
  insertComment,
  updateCommentBody,
  updateCommentAnchor,
  deleteComment as deleteCommentRow,
  setThreadResolved,
  insertReaction,
  deleteReaction,
  inviteCollaboratorViaEdge,
  removeCollaborator as removeCollaboratorRow,
  markNotificationRead,
  markAllNotificationsRead,
  triggerNotifyComment,
  rowToComment,
  rowToReaction,
  type CommentRow,
  type ReactionRow,
} from '../lib/comments';

export type CommentFilter = 'all' | 'me' | 'unresolved' | 'resolved' | 'detached';

export type ThreadAnchorScreenPos = { x: number; y: number } | null;

type CommentsState = {
  // Loaded data
  comments: Comment[];
  reactions: CommentReaction[];
  collaborators: Collaborator[];
  notifications: Notification[];

  // Loading flags
  loading: boolean;
  loadingNotifications: boolean;

  // Filter / open thread UI state
  filter: CommentFilter;
  openAnchor: CommentAnchor | null;
  openAnchorPos: ThreadAnchorScreenPos;
  detachedModalOpen: boolean;

  // Last-loaded blueprint (so we can reset cleanly on switch)
  loadedBlueprintRowId: string | null;

  // Loaders
  loadAll: (blueprintRowId: string, currentUserId: string | null) => Promise<void>;
  // Guest path: hydrate from a payload returned by `get-shared-blueprint`.
  // Skips collaborator + notification loads since RLS would deny the anon
  // client and the guest cannot write anyway.
  loadFromGuestPayload: (
    blueprintRowId: string,
    rawComments: unknown[],
    rawReactions: unknown[],
  ) => void;
  loadNotifications: (userId: string) => Promise<void>;
  reloadComments: (blueprintRowId: string) => Promise<void>;
  reloadReactions: (blueprintRowId: string) => Promise<void>;
  reloadCollaborators: (blueprintRowId: string) => Promise<void>;
  clear: () => void;

  // Comment mutations
  postComment: (input: {
    blueprintRowId: string;
    anchor: CommentAnchor;
    parentCommentId: string | null;
    authorUserId: string;
    authorName: string;
    authorEmail: string;
    body: string;
    mentions: CommentMention[];
  }) => Promise<Comment | null>;
  editComment: (commentId: string, body: string, mentions: CommentMention[]) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  toggleResolved: (rootCommentId: string, userId: string) => Promise<void>;

  // Reactions
  toggleReaction: (commentId: string, userId: string, emoji: CommentReactionEmoji) => Promise<void>;

  // Filter / open-thread
  setFilter: (f: CommentFilter) => void;
  openThread: (anchor: CommentAnchor, pos: ThreadAnchorScreenPos) => void;
  closeThread: () => void;
  setDetachedModalOpen: (on: boolean) => void;
  reattachThread: (rootCommentId: string, anchor: CommentAnchor) => Promise<void>;

  // Notifications
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;

  // Collaborators
  invite: (blueprintRowId: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;
};

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: [],
  reactions: [],
  collaborators: [],
  notifications: [],
  loading: false,
  loadingNotifications: false,
  filter: 'all',
  openAnchor: null,
  openAnchorPos: null,
  detachedModalOpen: false,
  loadedBlueprintRowId: null,

  loadAll: async (blueprintRowId, currentUserId) => {
    set({ loading: true, loadedBlueprintRowId: blueprintRowId });
    const [comments, reactions, collaborators] = await Promise.all([
      fetchComments(blueprintRowId),
      fetchReactions(blueprintRowId),
      fetchCollaborators(blueprintRowId),
    ]);
    set({ comments, reactions, collaborators, loading: false });
    if (currentUserId) {
      get().loadNotifications(currentUserId);
    }
  },

  loadFromGuestPayload: (blueprintRowId, rawComments, rawReactions) => {
    const comments = (rawComments as CommentRow[]).map(rowToComment);
    const reactions = (rawReactions as ReactionRow[]).map(rowToReaction);
    set({
      comments,
      reactions,
      collaborators: [],
      notifications: [],
      loadedBlueprintRowId: blueprintRowId,
      loading: false,
    });
  },

  loadNotifications: async (userId) => {
    set({ loadingNotifications: true });
    const notifications = await fetchNotifications(userId);
    set({ notifications, loadingNotifications: false });
  },

  reloadComments: async (blueprintRowId) => {
    const comments = await fetchComments(blueprintRowId);
    set({ comments });
  },

  reloadReactions: async (blueprintRowId) => {
    const reactions = await fetchReactions(blueprintRowId);
    set({ reactions });
  },

  reloadCollaborators: async (blueprintRowId) => {
    const collaborators = await fetchCollaborators(blueprintRowId);
    set({ collaborators });
  },

  clear: () => {
    set({
      comments: [],
      reactions: [],
      collaborators: [],
      notifications: [],
      openAnchor: null,
      openAnchorPos: null,
      loadedBlueprintRowId: null,
    });
  },

  postComment: async (input) => {
    const created = await insertComment({
      blueprintRowId: input.blueprintRowId,
      anchor: input.anchor,
      parentCommentId: input.parentCommentId,
      authorUserId: input.authorUserId,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      body: input.body,
      mentions: input.mentions,
    });
    if (created) {
      set((s) => ({ comments: [...s.comments, created] }));
      // Fire-and-forget notify
      triggerNotifyComment({ commentId: created.id });
    }
    return created;
  },

  editComment: async (commentId, body, mentions) => {
    await updateCommentBody(commentId, body, mentions);
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === commentId ? { ...c, body, mentions, updatedAt: new Date().toISOString() } : c,
      ),
    }));
  },

  removeComment: async (commentId) => {
    await deleteCommentRow(commentId);
    set((s) => ({
      comments: s.comments.filter((c) => c.id !== commentId && c.parentCommentId !== commentId),
      reactions: s.reactions.filter((r) => r.commentId !== commentId),
    }));
  },

  toggleResolved: async (rootCommentId, userId) => {
    const root = get().comments.find((c) => c.id === rootCommentId);
    if (!root) return;
    const willResolve = root.resolvedAt === null;
    const result = await setThreadResolved(rootCommentId, willResolve ? userId : null);
    if (!result) return;
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === rootCommentId
          ? { ...c, resolvedAt: result.resolvedAt, resolvedByUserId: result.resolvedByUserId }
          : c,
      ),
    }));
  },

  toggleReaction: async (commentId, userId, emoji) => {
    const existing = get().reactions.find(
      (r) => r.commentId === commentId && r.userId === userId && r.emoji === emoji,
    );
    if (existing) {
      // Optimistic remove
      set((s) => ({ reactions: s.reactions.filter((r) => r.id !== existing.id) }));
      await deleteReaction(commentId, userId, emoji);
    } else {
      const created = await insertReaction(commentId, userId, emoji);
      if (created) {
        set((s) => ({ reactions: [...s.reactions, created] }));
        triggerNotifyComment({ reactionId: created.id });
      }
    }
  },

  setFilter: (f) => set({ filter: f }),

  openThread: (anchor, pos) => set({ openAnchor: anchor, openAnchorPos: pos }),

  closeThread: () => set({ openAnchor: null, openAnchorPos: null }),

  setDetachedModalOpen: (on) => set({ detachedModalOpen: on }),

  reattachThread: async (rootCommentId, anchor) => {
    await updateCommentAnchor(rootCommentId, anchor);
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === rootCommentId || c.parentCommentId === rootCommentId
          ? { ...c, anchor }
          : c,
      ),
    }));
  },

  markRead: async (notificationId) => {
    await markNotificationRead(notificationId);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    }));
  },

  markAllRead: async (userId) => {
    await markAllNotificationsRead(userId);
    const now = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    }));
  },

  invite: async (blueprintRowId, email) => {
    const result = await inviteCollaboratorViaEdge(blueprintRowId, email);
    if (result.ok) {
      // Refresh list
      const collaborators = await fetchCollaborators(blueprintRowId);
      set({ collaborators });
    }
    return result;
  },

  removeCollaborator: async (collaboratorId) => {
    await removeCollaboratorRow(collaboratorId);
    set((s) => ({
      collaborators: s.collaborators.filter((c) => c.id !== collaboratorId),
    }));
  },
}));

// ─── Pure selectors (use outside the store call to keep refs stable) ─────────

export function commentsForAnchor(comments: Comment[], anchor: CommentAnchor): Comment[] {
  return comments.filter((c) => c.anchor.type === anchor.type && c.anchor.id === anchor.id);
}

export function rootCommentForAnchor(
  comments: Comment[],
  anchor: CommentAnchor,
): Comment | undefined {
  return commentsForAnchor(comments, anchor).find((c) => c.parentCommentId === null);
}

export function repliesForRoot(comments: Comment[], rootId: string): Comment[] {
  return comments
    .filter((c) => c.parentCommentId === rootId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function commentCountForAnchor(comments: Comment[], anchor: CommentAnchor): number {
  return commentsForAnchor(comments, anchor).length;
}

export function reactionsForComment(
  reactions: CommentReaction[],
  commentId: string,
): CommentReaction[] {
  return reactions.filter((r) => r.commentId === commentId);
}

export function unreadNotificationCount(notifications: Notification[]): number {
  return notifications.reduce((n, x) => (x.readAt ? n : n + 1), 0);
}

// Build the set of currently-valid anchor identities for a blueprint. An
// anchor is "detached" when its target element has been removed from the
// blueprint (action deleted, phase deleted, lane segment removed, etc.).
// Edges are derived at layout time so we treat any edge anchor whose source
// or target action no longer exists as detached.
export function buildAnchorRegistry(bp: Blueprint | null): Set<string> {
  const set = new Set<string>();
  if (!bp) return set;
  const k = (type: string, id: string) => `${type}:${id}`;
  for (const a of bp.actions) set.add(k('action', a.id));
  for (const p of bp.phases) set.add(k('phase', p.id));
  for (const a of bp.actors) set.add(k('actor', a.id));
  for (const lane of bp.statusLanes ?? []) {
    set.add(k('statusLane', lane.id));
    for (const seg of lane.segments) set.add(k('statusSegment', seg.id));
  }
  for (const lane of bp.timelineLanes ?? []) {
    set.add(k('timelineLane', lane.id));
    for (const seg of lane.segments) set.add(k('timelineSegment', seg.id));
  }
  // Edges: walk the action ids; an edge id encodes its source/target action
  // ids in known patterns (h-, x-, v-) — for custom edges we register the id
  // explicitly. For auto-generated edges we register every action pair so the
  // edge id is reachable.
  const actionIds = new Set(bp.actions.map((a) => a.id));
  for (const ce of bp.customEdges ?? []) {
    if (actionIds.has(ce.sourceActionId) && actionIds.has(ce.targetActionId)) {
      set.add(k('edge', ce.id));
    }
  }
  // Auto-edge ids follow `h-{src}-{tgt}` / `x-{src}-{tgt}` / `v-{src}-{tgt}`
  // patterns. Rather than reproduce layout.ts logic, accept any edge anchor
  // whose encoded source AND target action ids both still exist.
  return set;
}

export function isAnchorDetached(
  anchor: CommentAnchor,
  registry: Set<string>,
  actionIds: Set<string>,
): boolean {
  if (anchor.type === 'edge') {
    // Custom edges are registered directly.
    if (registry.has(`edge:${anchor.id}`)) return false;
    // Auto edges: parse `h-{src}-{tgt}` etc.
    const m = /^[hxv]-(.+)-(.+)$/.exec(anchor.id);
    if (m && actionIds.has(m[1]) && actionIds.has(m[2])) return false;
    return true;
  }
  return !registry.has(`${anchor.type}:${anchor.id}`);
}

export function filterComments(
  comments: Comment[],
  filter: CommentFilter,
  currentUserId: string | null,
  registry: Set<string>,
  actionIds: Set<string>,
): Comment[] {
  if (filter === 'all') return comments;
  return comments.filter((c) => {
    switch (filter) {
      case 'me':
        // Match if current user is mentioned OR is the author of any comment in this thread
        return (
          (currentUserId && c.mentions.some((m) => m.userId === currentUserId)) ||
          (currentUserId ? c.authorUserId === currentUserId : false)
        );
      case 'unresolved': {
        // Show comments whose root has no resolvedAt
        if (c.parentCommentId === null) return c.resolvedAt === null;
        const root = comments.find((x) => x.id === c.parentCommentId);
        return root ? root.resolvedAt === null : true;
      }
      case 'resolved': {
        if (c.parentCommentId === null) return c.resolvedAt !== null;
        const root = comments.find((x) => x.id === c.parentCommentId);
        return root ? root.resolvedAt !== null : false;
      }
      case 'detached':
        return isAnchorDetached(c.anchor, registry, actionIds);
      default:
        return true;
    }
  });
}
