import { Calendar } from 'lucide-react';
import { TRIP_START, TRIP_END, CONDO_ADDRESS } from '@/lib/trip-data';
import { useCountdown } from '@/lib/countdown';

export default function CountdownCard() {
  const start = useCountdown(TRIP_START);
  const end = useCountdown(TRIP_END);
  const tripActive = start.isPast && !end.isPast;

  return (
    <section className="bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl shadow-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={20} />
        <h2 className="text-lg font-semibold">
          {tripActive ? 'Trip in progress!' : start.isPast ? 'Trip complete' : 'Countdown to Port A'}
        </h2>
      </div>

      {!start.isPast && (
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {[
            { label: 'Days', value: start.days },
            { label: 'Hours', value: start.hours },
            { label: 'Minutes', value: start.minutes },
            { label: 'Seconds', value: start.seconds },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-3xl md:text-5xl font-bold tabular-nums">{value}</div>
              <div className="text-xs md:text-sm uppercase tracking-wide opacity-90">{label}</div>
            </div>
          ))}
        </div>
      )}

      {tripActive && (
        <div className="text-center text-2xl font-bold">
          {end.days}d {end.hours}h left in paradise
        </div>
      )}

      <div className="mt-3 text-sm text-orange-50">
        Departing Austin Monday May 25 morning · {CONDO_ADDRESS}
      </div>
    </section>
  );
}


