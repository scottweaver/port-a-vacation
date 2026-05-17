import { Waves } from 'lucide-react';
import { TIDE_FORECAST } from '@/lib/trip-data';
import CollapsibleCard from './CollapsibleCard';

export default function TideCard({ userId }: { userId: string }) {
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
          <p className="text-xs text-slate-500">
            Low tide = best shelling & wider beach. Approximate — verify with NOAA before going out.
          </p>
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
            {TIDE_FORECAST.map((t) => (
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
