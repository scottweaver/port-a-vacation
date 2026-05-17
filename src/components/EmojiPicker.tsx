import { useEffect, useRef } from 'react';

// Curated set — common reactions, beach/trip themed, family signals.
// Not exhaustive on purpose; for anything beyond this, the system emoji
// keyboard (Mac: Cmd+Ctrl+Space, iOS/Android: built into keyboard) covers
// the long tail. Avoids pulling in a 100KB+ picker library.
const EMOJI = [
  '😀','😂','😅','😊','🥹','🥰','😎','🤔','😴','😬',
  '🙄','🤷','🙌','👏','👍','👎','🤙','✌️','🫶','❤️',
  '🔥','💯','✨','🎉','💪','🤝','🫡','🙏','💩','😭',
  '🏖️','☀️','🌊','🌴','🐚','🦀','🐬','🌅','⛵','🛟',
  '🚗','🛻','🛺','🛏️','🏠','🧳','🩴','🩳','🧴','🕶️',
  '🍻','🍔','🍕','🌮','🍦','🍩','🍉','☕','🥤','🍿',
  '⏰','📅','📍','💬','❓','❗','✅','❌','⚠️','💡',
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg p-2 grid grid-cols-10 gap-0.5 max-w-[20rem]"
      role="dialog"
      aria-label="Pick an emoji"
    >
      {EMOJI.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => { onSelect(e); }}
          className="w-7 h-7 flex items-center justify-center text-base hover:bg-slate-100 rounded transition"
          aria-label={e}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
