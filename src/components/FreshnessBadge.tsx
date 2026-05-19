import { RefreshCw, CloudOff } from 'lucide-react';
import { cx } from '@/lib/format';
import type { DataSource } from '@/hooks/useWeather';

interface Props {
  source: DataSource;
  lastUpdated: Date | null;
  loading: boolean;
  attribution: string;       // 'Open-Meteo', 'NOAA CO-OPS'
  onRefresh: () => void;
}

/**
 * Small "Updated X ago · Provider" pill with a manual refresh button.
 * Shown next to the WeatherCard / TideCard headers so users know whether
 * what they're looking at is live, cached, or the baked-in fallback.
 */
export default function FreshnessBadge({ source, lastUpdated, loading, attribution, onRefresh }: Props) {
  const isFallback = source === 'fallback';
  return (
    <div className={cx(
      'inline-flex items-center gap-1.5 text-xs',
      isFallback ? 'text-coral-700' : 'text-slate-500',
    )}>
      {isFallback && <CloudOff size={12} className="flex-shrink-0" />}
      <span>
        {isFallback
          ? `Showing baked-in estimates · ${attribution} unreachable`
          : `${describeAge(lastUpdated)} · ${attribution}`}
      </span>
      <button
        type="button"
        onClick={(e) => {
          // FreshnessBadge sits inside CollapsibleCard's header slot, which
          // is wrapped in a toggle <button>. Without stopPropagation the
          // click bubbles up and collapses the card.
          e.stopPropagation();
          onRefresh();
        }}
        disabled={loading}
        className={cx(
          'p-0.5 rounded transition flex-shrink-0',
          loading ? 'text-slate-300 cursor-wait' : 'text-slate-400 hover:text-slate-700',
        )}
        title="Refresh now"
        aria-label="Refresh now"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}

function describeAge(lastUpdated: Date | null): string {
  if (!lastUpdated) return 'Updating…';
  const seconds = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
  if (seconds < 60) return 'Updated just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}
