import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { Markdown } from '@/lib/markdown';

interface Props {
  version: string;
  onClose: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; source: string }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export default function ReleaseNotesModal({ version, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const res = await fetch(`/release-notes/${encodeURIComponent(version)}.md`, { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: 'missing' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'error', message: `HTTP ${res.status}` });
          return;
        }
        const text = await res.text();
        if (cancelled) return;
        setState({ kind: 'loaded', source: text });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to load' });
      }
    })();
    return () => { cancelled = true; };
  }, [version]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-xl flex flex-col h-full sm:h-[min(80vh,720px)] overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">
            What's new <span className="text-slate-400 font-normal ml-1">v{version}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {state.kind === 'loaded' && <Markdown source={state.source} />}

          {state.kind === 'missing' && (
            <div className="py-8 text-center text-sm text-slate-500 space-y-3">
              <p>Release notes for v{version} aren't bundled with the app.</p>
              <a
                href={`https://github.com/scottweaver/port-a-vacation/releases/tag/version/${encodeURIComponent(version)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-ocean-700 hover:text-ocean-900 underline underline-offset-2"
              >
                View on GitHub <ExternalLink size={12} />
              </a>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="py-8 text-center text-sm text-coral-600">
              Couldn't load release notes ({state.message}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
