import { Car } from 'lucide-react';
import { DRIVE_STOPS, DRIVE_DISTANCE_MILES, DRIVE_DURATION_HOURS, DRIVE_ROUTE_SUMMARY } from '@/lib/trip-data';
import CollapsibleCard from './CollapsibleCard';

export default function DriveCard({ userId }: { userId: string }) {
  return (
    <CollapsibleCard
      storageKey="drive"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Car size={20} className="text-slate-700" />
            Drive: Austin → Port Aransas
          </h2>
          <p className="text-xs text-slate-500">
            ~{DRIVE_DURATION_HOURS} hours · ~{DRIVE_DISTANCE_MILES} miles · {DRIVE_ROUTE_SUMMARY}
          </p>
        </>
      }
    >
      <div className="space-y-2">
        {DRIVE_STOPS.map((stop, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="flex flex-col items-center pt-1">
              <div className={
                i === 0 ? 'w-3 h-3 rounded-full bg-emerald-500'
                : i === DRIVE_STOPS.length - 1 ? 'w-3 h-3 rounded-full bg-pink-500'
                : 'w-3 h-3 rounded-full bg-ocean-400'
              } />
              {i < DRIVE_STOPS.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-slate-800">{stop.name}</span>
                <span className="text-xs text-slate-500 font-mono">+{stop.time}</span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">{stop.note}</div>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}
