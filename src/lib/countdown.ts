import { useEffect, useState } from 'react';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function useCountdown(target: Date): Countdown {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now.getTime();
  const isPast = diff < 0;
  const abs = Math.abs(diff);

  return {
    days: Math.floor(abs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((abs % (1000 * 60)) / 1000),
    isPast,
  };
}


