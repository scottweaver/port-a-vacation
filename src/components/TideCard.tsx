import { Waves } from 'lucide-react';
import { useTides } from '@/hooks/useTides';
import CollapsibleCard from './CollapsibleCard';
import FreshnessBadge from './FreshnessBadge';

export default function TideCard({ userId }: { userId: string }) {
  const { tides, source, lastUpdated, loading, refresh } = useTides();
  return (
    <CollapsibleCard
      storageKey="tide"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Waves size={20} className="text-teal-600" />
            Tide Chart
          </h2>
          <FreshnessBadge
            source={source}
            lastUpdated={lastUpdated}
            loading={loading}
            attribution="NOAA CO-OPS · Port Aransas"
            onRefresh={refresh}
          />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="pb-2 font-semibold">Day</th>
              <th className="pb-2 font-semibold">High Tides</th>
              <th className="pb-2 font-semibold">Low Tides</th>
              <th className="pb-2 font-semibold">Best Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tides.map((t) => (
              <tr key={t.date}>
                <td className="py-2 font-medium text-slate-700">{t.date}</td>
                <td className="py-2 text-slate-600">{t.highs.join(', ')}</td>
                <td className="py-2 text-slate-600">{t.lows.join(', ')}</td>
                <td className="py-2 text-teal-700 italic text-xs">{t.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}
