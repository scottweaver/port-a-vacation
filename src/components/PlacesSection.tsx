import { MapPin, Phone, Star } from 'lucide-react';
import { RESTAURANTS, ACTIVITIES, type Place } from '@/lib/trip-data';

export default function PlacesSection() {
  return (
    <>
      <section className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          🍤 Top Family Restaurants
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {RESTAURANTS.map((r) => <PlaceCard key={r.name} place={r} />)}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          🎢 Kid-Friendly Activities
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {ACTIVITIES.map((a) => <PlaceCard key={a.name} place={a} />)}
        </div>
      </section>
    </>
  );
}

function PlaceCard({ place }: { place: Place }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 hover:shadow-md transition bg-gradient-to-br from-white to-slate-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold text-slate-800 text-sm">{place.name}</div>
          <div className="text-xs text-slate-500">{place.type}</div>
        </div>
        <div className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
          <Star size={12} fill="currentColor" /> {place.rating}
          {place.reviewCount && (
            <span className="text-amber-500/70 font-normal ml-0.5">({place.reviewCount.toLocaleString()})</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{place.note}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
        {place.address && (
          <div className="flex items-center gap-1">
            <MapPin size={12} /> {place.address}
          </div>
        )}
        {place.phone && (
          <a href={`tel:${place.phone}`} className="flex items-center gap-1 text-ocean-600 hover:underline">
            <Phone size={12} /> {place.phone}
          </a>
        )}
      </div>
    </div>
  );
}


