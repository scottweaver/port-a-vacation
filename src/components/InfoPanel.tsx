import { AlertCircle } from 'lucide-react';
import { INFO_TILES } from '@/lib/trip-data';

export default function InfoPanel() {
  return (
    <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl shadow p-5">
      <h2 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
        <AlertCircle size={20} />
        Need to Know
      </h2>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        {INFO_TILES.map((tile) => (
          <div key={tile.title}>
            <div className="font-semibold text-amber-900">{tile.icon} {tile.title}</div>
            <div className="text-amber-800 mt-1">{tile.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


