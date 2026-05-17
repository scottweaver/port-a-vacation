import { MapPin, Clock, Users, Phone, AlarmClock } from 'lucide-react';
import type { BookedActivity } from '@/lib/trip-data';
import CollapsibleCard from './CollapsibleCard';

interface Props {
  activity: BookedActivity;
  userId: string;
}

export default function BookedActivityCard({ activity, userId }: Props) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.address)}`;
  const telHref = activity.phone ? `tel:${activity.phone.replace(/[^\d+]/g, '')}` : null;

  return (
    <CollapsibleCard
      storageKey={`booking:${activity.bookingRef ?? activity.name}`}
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span aria-hidden>{activity.emoji}</span>
            <span>{activity.name}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activity.vendor}
            {activity.bookingRef && (
              <span className="ml-1 text-slate-400">· Booking #{activity.bookingRef}</span>
            )}
          </p>
        </>
      }
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-sm bg-ocean-50 text-ocean-700 rounded-lg px-2.5 py-1">
          <Clock size={14} />
          {activity.date} · {activity.startTime} – {activity.endTime}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg px-2.5 py-1">
          <Users size={14} />
          {activity.party}
        </span>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
            <MapPin size={14} className="text-slate-500" />
            Parking & location
          </div>
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2"
          >
            {activity.address}
          </a>
          <p className="text-slate-600 mt-1">{activity.parkingNote}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
            <AlarmClock size={14} className="text-slate-500" />
            Check-in
          </div>
          <p className="text-slate-600">{activity.checkIn}</p>
        </div>

        {telHref && (
          <div className="text-slate-500 text-xs flex items-center gap-1.5 pt-1 border-t border-slate-100">
            <Phone size={12} />
            <a href={telHref} className="hover:text-slate-700">{activity.phone}</a>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
