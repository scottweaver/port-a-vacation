import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="animate-spin" size={32} />
        <div className="text-sm">Loading…</div>
      </div>
    </div>
  );
}


