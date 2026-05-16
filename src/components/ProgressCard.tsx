import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChecklistItem, Contribution, Family } from '@/types/db';
import { CATEGORIES } from '@/lib/trip-data';

interface Props {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  families: Family[];
}

export default function ProgressCard({ items, contributions, families }: Props) {
  const stats = useMemo(() => {
    const byCategory: Record<string, { total: number; covered: number }> = {};
    const familyCount = families.length || 1;

    for (const item of items) {
      const cat = CATEGORIES.find((c) => c.key === item.category);
      if (!cat) continue;

      let satisfied = 0;
      for (const f of families) {
        const c = contributions.get(`${item.id}::${f.id}`);
        if (!c) continue;
        if (item.tracking_type === 'task' ? c.done : c.quantity > 0) {
          satisfied += 1;
        }
      }

      const covered = cat.scope === 'shared' ? satisfied >= 1 : satisfied >= familyCount;
      const bucket = byCategory[item.category] ?? { total: 0, covered: 0 };
      bucket.total += 1;
      if (covered) bucket.covered += 1;
      byCategory[item.category] = bucket;
    }

    let total = 0;
    let covered = 0;
    for (const v of Object.values(byCategory)) {
      total += v.total;
      covered += v.covered;
    }

    return {
      byCategory,
      total,
      covered,
      pct: total > 0 ? Math.round((covered / total) * 100) : 0,
    };
  }, [items, contributions, families]);

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-600" />
          Trip Prep Progress
        </h2>
        <div className="text-sm text-slate-600 font-medium">
          {stats.covered} / {stats.total} ({stats.pct}%)
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full transition-all duration-500"
          style={{ width: `${stats.pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
        {CATEGORIES.map((cat) => {
          const s = stats.byCategory[cat.key] ?? { total: 0, covered: 0 };
          return (
            <a
              key={cat.key}
              href={`#cat-${cat.key}`}
              className="text-left text-xs p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="font-medium truncate text-slate-700">{cat.emoji} {cat.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.covered}/{s.total}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
}


