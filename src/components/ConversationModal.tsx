import { useEffect, useRef, useState } from 'react';
import { X, Send, Pencil, Trash2, Check, X as XCancel, Smile } from 'lucide-react';
import type { ChecklistItem, Message, Profile } from '@/types/db';
import { cx, firstName, relativeTime } from '@/lib/format';
import { messageColor } from '@/lib/messageColor';
import { linkify } from '@/lib/linkify';
import EmojiPicker from './EmojiPicker';

interface Props {
  item: ChecklistItem;
  messages: Message[];
  /** False until the per-thread content fetch resolves. Lets us distinguish
   *  "no messages yet" from "still loading." */
  isLoaded: boolean;
  profiles: Map<string, Profile>;
  currentUserId: string;
  onClose: () => void;
  onPost: (itemId: string, content: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
}

export default function ConversationModal({
  item, messages, isLoaded, profiles, currentUserId, onClose, onPost, onEdit, onDelete,
}: Props) {
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setDraft((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    // Move caret to right after the inserted emoji on next tick.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Scroll to bottom on open and whenever a new message lands.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus the input on open.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function send() {
    const content = draft.trim();
    if (!content) return;
    onPost(item.id, content);
    setDraft('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-xl flex flex-col h-full sm:h-[min(80vh,640px)] overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">{item.label}</h2>
            <p className="text-xs text-slate-500">
              {messages.length === 0 ? 'No messages yet — start the conversation.' : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto relative"
          style={{
            backgroundImage: 'url(/beach-bg.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'local',
          }}
        >
          {/* Semi-opaque overlay fades the photo so bubbles stay legible. */}
          <div className="absolute inset-0 bg-white/75 pointer-events-none" aria-hidden />
          <div className="relative px-3 py-3 space-y-3 min-h-full">
            {!isLoaded ? (
              <div className="text-center text-sm text-slate-500 py-8">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                Be the first to say something.
              </div>
            ) : (
              messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  profile={profiles.get(m.author_id)}
                  isMine={m.author_id === currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="relative border-t border-slate-200 p-3 flex items-end gap-2 bg-white"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Write a message…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200 max-h-32"
          />
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            className={cx(
              'p-2 rounded-lg transition flex-shrink-0',
              emojiOpen ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
            )}
            aria-label="Insert emoji"
          >
            <Smile size={16} />
          </button>
          <button
            type="submit"
            disabled={!draft.trim()}
            className={cx(
              'p-2 rounded-lg transition flex-shrink-0',
              draft.trim()
                ? 'bg-ocean-600 text-white hover:bg-ocean-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            )}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
          {emojiOpen && (
            <EmojiPicker
              onSelect={(e) => { insertEmoji(e); }}
              onClose={() => setEmojiOpen(false)}
            />
          )}
        </form>
      </div>
    </div>
  );
}

function MessageRow({
  message, profile, isMine, onEdit, onDelete,
}: {
  message: Message;
  profile: Profile | undefined;
  isMine: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const color = messageColor(message.author_id);
  const name = profile ? firstName(profile.display_name, profile.email) : 'Someone';

  function saveEdit() {
    const t = draft.trim();
    if (t && t !== message.content) onEdit(message.id, t);
    setEditing(false);
  }

  return (
    <div className={cx('flex gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
      <div className="flex-shrink-0">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-7 h-7 rounded-full border-2"
            style={{ borderColor: color.ring }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-slate-700 border-2"
            style={{ backgroundColor: color.bubbleBg, borderColor: color.ring }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className={cx('flex-1 min-w-0 flex flex-col', isMine ? 'items-end' : 'items-start')}>
        <div className="text-xs text-slate-500 px-1 flex items-center gap-1.5">
          <span className="font-medium text-slate-700">{name}</span>
          <span>· {relativeTime(message.created_at)}</span>
          {message.edited_at && <span className="italic text-slate-400">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1 w-full">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:border-ocean-400"
              autoFocus
            />
            <div className="flex justify-end gap-1 mt-1">
              <button
                onClick={() => { setEditing(false); setDraft(message.content); }}
                className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <XCancel size={12} /> Cancel
              </button>
              <button
                onClick={saveEdit}
                className="text-xs px-2 py-1 text-ocean-700 hover:text-ocean-900 font-medium flex items-center gap-1"
              >
                <Check size={12} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className="mt-1 max-w-[85%] px-3 py-2 rounded-lg text-sm text-slate-800 border whitespace-pre-wrap break-words"
            style={{ backgroundColor: color.bubbleBg, borderColor: color.bubbleBorder }}
          >
            {linkify(message.content).map((seg, i) => seg.type === 'link' ? (
              <a
                key={i}
                href={seg.value}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900 break-all"
              >
                {seg.value}
              </a>
            ) : (
              <span key={i}>{seg.value}</span>
            ))}
          </div>
        )}

        {isMine && !editing && (
          <div className="flex gap-1 mt-1 px-1">
            <button
              onClick={() => { setDraft(message.content); setEditing(true); }}
              className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
              title="Edit"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => (confirmDelete ? onDelete(message.id) : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              className={cx(
                'text-xs flex items-center gap-1',
                confirmDelete ? 'text-coral-600' : 'text-slate-400 hover:text-coral-500',
              )}
              title={confirmDelete ? 'Click again to confirm' : 'Delete'}
            >
              <Trash2 size={11} />
              {confirmDelete && <span>delete?</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
