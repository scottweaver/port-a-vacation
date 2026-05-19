import { Home, ExternalLink } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

const PORTAL_URL = import.meta.env.VITE_CONDO_PORTAL_URL;

export default function CondoPortalCard({ userId }: { userId: string }) {
  return (
    <CollapsibleCard
      storageKey="condo-portal"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Home size={20} className="text-coral-500" />
            Condo Portal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">1900 S 11th St, Port Aransas</p>
        </>
      }
    >
      {PORTAL_URL ? (
        <div className="space-y-2">
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-coral-500 hover:bg-coral-600 text-white font-medium text-sm transition w-full sm:w-auto justify-center"
          >
            Open portal
            <ExternalLink size={14} />
          </a>
          <p className="text-xs text-slate-500">
            Logs you in automatically — check-in instructions, wifi, house manual, and more.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Portal link not configured.</p>
      )}
    </CollapsibleCard>
  );
}
