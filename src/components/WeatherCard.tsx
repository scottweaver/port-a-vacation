import { Sun } from 'lucide-react';
import { WEATHER_FORECAST, conditionIcon, conditionLabel } from '@/lib/trip-data';
import CollapsibleCard from './CollapsibleCard';

export default function WeatherCard({ userId }: { userId: string }) {
  return (
    <CollapsibleCard
      storageKey="weather"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Sun size={20} className="text-amber-500" />
            Weather Forecast
          </h2>
          <p className="text-xs text-slate-500">
            5-day outlook for Port Aransas. Refresh closer to trip for live conditions.
          </p>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {WEATHER_FORECAST.map((d) => {
          const Icon = conditionIcon[d.condition];
          return (
            <div key={d.date} className="bg-gradient-to-br from-ocean-50 to-cyan-50 rounded-xl p-3 border border-ocean-100">
              <div className="text-xs font-semibold text-ocean-700">{d.day}</div>
              <div className="text-xs text-slate-500 mb-2">{d.date}</div>
              <Icon size={28} className="text-amber-500 mb-2" />
              <div className="text-lg font-bold text-slate-800">
                {d.high}°<span className="text-sm text-slate-400 font-normal">/{d.low}°</span>
              </div>
              <div className="text-xs text-slate-600">{conditionLabel[d.condition]}</div>
              <div className="text-xs text-ocean-600 mt-1">💧 {d.rainChance}%</div>
              <div className="text-xs text-slate-500 italic mt-1">{d.note}</div>
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
