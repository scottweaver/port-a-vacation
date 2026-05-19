import { useMemo } from 'react';
import { Compass, MapPin, Phone, Clock } from 'lucide-react';
import { ON_ISLAND_ESSENTIALS, type OnIslandEssential } from '@/lib/trip-data';
import CollapsibleCard from './CollapsibleCard';

export default function OnIslandCard({ userId }: { userId: string }) {
  // Group by category so duplicate categories (if added later) cluster
  // together while preserving the curator's order across categories.
  const byCategory = useMemo(() => {
    const groups: { category: string; entries: OnIslandEssential[] }[] = [];
    for (const e of ON_ISLAND_ESSENTIALS) {
      const existing = groups.find((g) => g.category === e.category);
      if (existing) existing.entries.push(e);
      else groups.push({ category: e.category, entries: [e] });
    }
    return groups;
  }, []);

  return (
    <CollapsibleCard
      storageKey="on-island-essentials"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Compass size={20} className="text-ocean-600" />
            On-Island Essentials
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stuff you can grab without crossing the ferry.
          </p>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {byCategory.flatMap((g) =>
          g.entries.map((e) => <EssentialCard key={e.name} entry={e} />),
        )}
      </div>
    </CollapsibleCard>
  );
}

function EssentialCard({ entry }: { entry: OnIslandEssential }) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${entry.name}, ${entry.address}, Port Aransas, TX`,
  )}`;
  const telHref = entry.phone ? `tel:${entry.phone.replace(/[^\d+]/g, '')}` : null;
  return (
    <div className="border border-slate-200 rounded-xl p-3 hover:shadow-md transition bg-gradient-to-br from-white to-sand-50">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-xl leading-none mt-0.5">{entry.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{entry.name}</div>
          <div className="text-xs text-slate-500">{entry.category}</div>
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{entry.note}</p>
      <div className="mt-2 space-y-1 text-xs">
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-ocean-600 hover:text-ocean-700 hover:underline"
        >
          <MapPin size={12} className="flex-shrink-0" /> {entry.address}
        </a>
        {telHref && entry.phone && (
          <a href={telHref} className="flex items-center gap-1 text-ocean-600 hover:text-ocean-700 hover:underline">
            <Phone size={12} className="flex-shrink-0" /> {entry.phone}
          </a>
        )}
        {entry.hours && (
          <div className="flex items-center gap-1 text-slate-500">
            <Clock size={12} className="flex-shrink-0" /> {entry.hours}
          </div>
        )}
      </div>
    </div>
  );
}
