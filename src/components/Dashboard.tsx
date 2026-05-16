import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/db';
import { useFamilies } from '@/hooks/useFamilies';
import { useChecklist } from '@/hooks/useChecklist';
import { useProfiles } from '@/hooks/useProfiles';
import { useAdmin } from '@/hooks/useAdmin';
import { CATEGORIES } from '@/lib/trip-data';
import TopBar from './TopBar';
import CountdownCard from './CountdownCard';
import WeatherCard from './WeatherCard';
import TideCard from './TideCard';
import DriveCard from './DriveCard';
import ChecklistSection from './ChecklistSection';
import PlacesSection from './PlacesSection';
import InfoPanel from './InfoPanel';
import AdminPanel from './AdminPanel';
import ProgressCard from './ProgressCard';

interface Props {
  session: Session;
  profile: Profile;
  onSignOut: () => Promise<void>;
}

type Tab = 'trip' | 'admin';

export default function Dashboard({ session, profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('trip');

  const { families } = useFamilies();
  const profiles = useProfiles(true);
  const checklist = useChecklist(session.user.id);
  const admin = useAdmin(profile.is_admin, session.user.id);

  const familyById = useMemo(
    () => new Map(families.map((f) => [f.id, f])),
    [families],
  );

  return (
    <div className="min-h-screen">
      <TopBar
        profile={profile}
        families={families}
        pendingCount={admin.pending.length}
        currentTab={tab}
        onTabChange={setTab}
        onSignOut={onSignOut}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {tab === 'trip' ? (
          <>
            <CountdownCard />
            <ProgressCard
              items={checklist.items}
              contributions={checklist.contributions}
              families={families}
            />
            <WeatherCard />
            <TideCard />
            <DriveCard />

            {CATEGORIES.map((cat) => (
              <ChecklistSection
                key={cat.key}
                category={cat}
                items={checklist.itemsByCategory.get(cat.key) ?? []}
                families={families}
                profiles={profiles}
                familyById={familyById}
                getContribution={checklist.getContribution}
                onAdjustQuantity={checklist.adjustQuantity}
                onToggleTask={checklist.toggleTask}
                onAddItem={checklist.addCustomItem}
                onDeleteItem={checklist.deleteCustomItem}
                currentUserId={session.user.id}
                myFamilyId={profile.family_id}
              />
            ))}

            <PlacesSection />
            <InfoPanel />

            <footer className="text-center text-xs text-slate-400 py-6">
              Have a great trip! 🌊
            </footer>
          </>
        ) : (
          <AdminPanel
            pending={admin.pending}
            onApprove={admin.approve}
            onDeny={admin.deny}
            onReconsider={admin.reconsider}
            error={admin.error}
          />
        )}
      </main>
    </div>
  );
}


