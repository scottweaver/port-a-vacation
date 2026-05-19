import { useEffect } from 'react';
import { Calendar } from 'lucide-react';
import confetti from 'canvas-confetti';
import { TRIP_START, TRIP_END, CONDO_ADDRESS } from '@/lib/trip-data';
import { useCountdown } from '@/lib/countdown';

const CELEBRATED_KEY = 'port-a:trip-start-celebrated';

export default function CountdownCard() {
  const start = useCountdown(TRIP_START);
  const end = useCountdown(TRIP_END);
  const tripActive = start.isPast && !end.isPast;

  // Fire confetti once per device when the trip has started. Two paths
  // both hit this effect:
  //   1. User watching at the moment the countdown ticks past zero —
  //      start.isPast transitions false → true and the effect runs.
  //   2. User loads the app AFTER the trip has started — start.isPast is
  //      true on initial mount and the effect runs immediately.
  // Either way, the localStorage flag guarantees a single celebration per
  // device. Reloads after celebrating do nothing. (Flag is per-device, not
  // synced — each browser/phone gets its own one-time burst, which feels
  // right: everyone deserves to see it once.)
  useEffect(() => {
    if (!start.isPast) return;
    try {
      if (window.localStorage.getItem(CELEBRATED_KEY)) return;
      window.localStorage.setItem(CELEBRATED_KEY, new Date().toISOString());
    } catch {
      // localStorage unavailable (private mode, quota); just fire — worst
      // case is the user sees confetti on every reload, which is hardly
      // tragic for a 4-day trip.
    }
    void launchConfetti();
  }, [start.isPast]);

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

// Gulf-palette confetti burst — three quick bursts staggered ~150ms apart so
// the celebration lasts ~½ second instead of one instant pop. Uses the Gulf
// sunset palette + ocean blue for thematic continuity with the rest of the
// app, and falls particles from above the countdown card so they rain down
// across the visible viewport.
async function launchConfetti() {
  const colors = ['#c2566e', '#e87a5d', '#f4b56b', '#fb7185', '#38bdf8'];
  const fire = (overrides: confetti.Options) => confetti({
    spread: 70,
    startVelocity: 45,
    colors,
    ticks: 200,
    ...overrides,
  });
  // Center burst
  fire({ particleCount: 80, origin: { y: 0.3, x: 0.5 } });
  await sleep(150);
  // Left and right side bursts for wider coverage
  fire({ particleCount: 60, angle: 60,  origin: { y: 0.5, x: 0 } });
  fire({ particleCount: 60, angle: 120, origin: { y: 0.5, x: 1 } });
  await sleep(150);
  fire({ particleCount: 100, origin: { y: 0.4, x: 0.5 } });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


