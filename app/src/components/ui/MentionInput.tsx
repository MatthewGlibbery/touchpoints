import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { Collaborator, CommentMention } from '../../types/blueprint';

type MentionCandidate = {
  userId: string;
  name: string;
  email: string;
};

export type MentionInputHandle = {
  focus: () => void;
  // Returns the canonical body (mentions encoded as @[name](userId)) plus the
  // resolved mentions array. Mentions whose token no longer appears in the
  // text are dropped.
  serialize: () => { body: string; mentions: CommentMention[] };
  clear: () => void;
};

interface Props {
  collaborators: Collaborator[];
  ownerEmail?: string | null;       // mentionable in addition to collaborators
  ownerUserId?: string | null;
  ownerName?: string | null;        // display name of the owner (preferred over email when present)
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;            // Cmd/Ctrl+Enter
  onChangeText?: (text: string) => void;
  rows?: number;
  style?: CSSProperties;
}

// Build the candidate list: accepted collaborators (must have userId) + owner.
// Pending invites (userId === null) are not mentionable yet — we can't
// reference a user that doesn't exist in auth.users.
function buildCandidates(
  collaborators: Collaborator[],
  ownerEmail?: string | null,
  ownerUserId?: string | null,
  ownerName?: string | null,
): MentionCandidate[] {
  const list: MentionCandidate[] = [];
  if (ownerEmail && ownerUserId) {
    const trimmed = (ownerName ?? '').trim();
    list.push({ userId: ownerUserId, email: ownerEmail, name: trimmed || ownerEmail });
  }
  for (const c of collaborators) {
    if (!c.userId) continue;
    // Prefer the collaborator's stored display name when present (populated by
    // the auth.users reconcile trigger); fall back to their email otherwise.
    const name = c.name?.trim() || c.email;
    list.push({ userId: c.userId, email: c.email, name });
  }
  // Dedupe by userId (owner could appear in collaborators)
  const seen = new Set<string>();
  return list.filter((m) => {
    if (seen.has(m.userId)) return false;
    seen.add(m.userId);
    return true;
  });
}

export const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { collaborators, ownerEmail, ownerUserId, ownerName, placeholder, autoFocus, onSubmit, onChangeText, rows = 2, style },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  // Mentions added so far, keyed by userId. We carry forward only those whose
  // `@<name>` token still appears in the current text.
  const [mentions, setMentions] = useState<MentionCandidate[]>([]);

  // Autocomplete popover state
  const [query, setQuery] = useState<string | null>(null);
  const [queryStart, setQueryStart] = useState<number>(-1); // index of '@'
  const [highlight, setHighlight] = useState(0);

  const candidates = useMemo(
    () => buildCandidates(collaborators, ownerEmail, ownerUserId, ownerName),
    [collaborators, ownerEmail, ownerUserId, ownerName],
  );

  const filteredCandidates = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return candidates
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [candidates, query]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    serialize: () => serialize(text, mentions),
    clear: () => {
      setText('');
      setMentions([]);
      setQuery(null);
    },
  }), [text, mentions]);

  // Drop mentions whose token (@<name>) no longer appears in the text
  useEffect(() => {
    setMentions((prev) => prev.filter((m) => text.includes(`@${m.name}`)));
    onChangeText?.(text);
  }, [text, onChangeText]);

  function detectQuery(value: string, caret: number) {
    // Walk back from caret to find a preceding '@' with no whitespace between.
    // The '@' must be at start-of-text or preceded by whitespace.
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === '@') {
        const prev = i === 0 ? ' ' : value[i - 1];
        if (/\s/.test(prev) || i === 0) {
          const q = value.slice(i + 1, caret);
          if (q.length === 0 || /^[\w.\-+@]*$/.test(q)) {
            setQuery(q);
            setQueryStart(i);
            setHighlight(0);
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    setQuery(null);
    setQueryStart(-1);
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    const caret = e.target.selectionStart ?? value.length;
    detectQuery(value, caret);
  }

  function onSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    detectQuery(ta.value, ta.selectionStart ?? ta.value.length);
  }

  function pickCandidate(cand: MentionCandidate) {
    if (queryStart < 0) return;
    const before = text.slice(0, queryStart);
    const after = text.slice((textareaRef.current?.selectionStart ?? text.length));
    const insertion = `@${cand.name} `;
    const next = before + insertion + after;
    setText(next);
    setMentions((prev) => {
      if (prev.some((m) => m.userId === cand.userId)) return prev;
      return [...prev, cand];
    });
    setQuery(null);
    setQueryStart(-1);
    // Restore caret position right after the inserted mention
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = before.length + insertion.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Mention picker navigation
    if (query !== null && filteredCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(filteredCandidates.length - 1, h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickCandidate(filteredCandidates[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={onChange}
        onSelect={onSelect}
        onKeyDown={onKeyDown}
        rows={rows}
        style={{
          width: '100%',
          resize: 'vertical',
          minHeight: 56,
          padding: 8,
          fontSize: 13,
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-bg)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          ...style,
        }}
      />
      {query !== null && filteredCandidates.length > 0 && (
        <div
          className="mention-popover"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            minWidth: 220,
            maxWidth: 280,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          {filteredCandidates.map((c, i) => (
            <button
              key={c.userId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickCandidate(c);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '7px 10px',
                background: i === highlight ? 'var(--surface-bg-muted)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {c.name}
              </span>
              {c.email !== c.name && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// Convert plain text + mentions list into the canonical wire format with
// `@[name](userId)` tokens. Mentions whose `@<name>` token does not appear
// in the text are dropped.
function serialize(
  text: string,
  mentions: MentionCandidate[],
): { body: string; mentions: CommentMention[] } {
  let body = text;
  const used: CommentMention[] = [];
  // Sort by name length desc so longer names replace before shorter prefixes
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    const token = `@${m.name}`;
    if (body.includes(token)) {
      // Replace ALL occurrences (the user may have referenced them multiple times)
      body = body.split(token).join(`@[${m.name}](${m.userId})`);
      used.push({ userId: m.userId, email: m.email, name: m.name });
    }
  }
  return { body, mentions: used };
}

// ─── Renderer for displaying comment bodies with mention chips ───────────────

export function renderCommentBody(
  body: string,
  currentUserId: string | null,
): React.ReactNode {
  // Match `@[name](userId)` tokens. Names may contain anything except `]`.
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    if (m.index > last) {
      out.push(body.slice(last, m.index));
    }
    const isMe = currentUserId && m[2] === currentUserId;
    out.push(
      <span
        key={`mention-${key++}`}
        className="mention-chip"
        style={{
          display: 'inline-block',
          padding: '0 6px',
          borderRadius: 'var(--radius-pill)',
          fontWeight: 600,
          color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)',
          background: isMe ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
          fontSize: '0.92em',
        }}
      >
        @{m[1]}
      </span>,
    );
    last = regex.lastIndex;
  }
  if (last < body.length) {
    out.push(body.slice(last));
  }
  return out;
}
