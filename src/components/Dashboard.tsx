import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/db';
import { useFamilies } from '@/hooks/useFamilies';
import { useChecklist } from '@/hooks/useChecklist';
import { useProfiles } from '@/hooks/useProfiles';
import { useAdmin } from '@/hooks/useAdmin';
import { usePacking } from '@/hooks/usePacking';
import { CATEGORIES, BOOKED_ACTIVITIES } from '@/lib/trip-data';
import TopBar from './TopBar';
import CountdownCard from './CountdownCard';
import WeatherCard from './WeatherCard';
import TideCard from './TideCard';
import DriveCard from './DriveCard';
import BookedActivityCard from './BookedActivityCard';
import ChecklistSection from './ChecklistSection';
import PlacesSection from './PlacesSection';
import InfoPanel from './InfoPanel';
import AdminPanel from './AdminPanel';
import ProgressCard from './ProgressCard';
import PackView from './PackView';

interface Props {
  session: Session;
  profile: Profile;
  onSignOut: () => Promise<void>;
}

type Tab = 'trip' | 'admin';
type Mode = 'dashboard' | 'pack';

export default function Dashboard({ session, profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('trip');
  const [mode, setMode] = useState<Mode>('dashboard');

  const { families } = useFamilies();
  const profiles = useProfiles(true);
  const checklist = useChecklist(session.user.id);
  const admin = useAdmin(profile.is_admin, session.user.id);
  const packing = usePacking(session.user.id, profile.family_id);

  const familyById = useMemo(
    () => new Map(families.map((f) => [f.id, f])),
    [families],
  );

  if (mode === 'pack' && profile.family_id) {
    const myFamily = familyById.get(profile.family_id);
    if (myFamily) {
      return (
        <PackView
          items={checklist.items}
          contributions={checklist.contributions}
          packed={packing.packed}
          myFamily={myFamily}
          currentUserId={session.user.id}
          onTogglePacked={packing.togglePacked}
          onExit={() => setMode('dashboard')}
        />
      );
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar
        profile={profile}
        families={families}
        pendingCount={admin.pending.length}
        currentTab={tab}
        onTabChange={setTab}
        onPackMode={() => setMode('pack')}
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
            <WeatherCard userId={session.user.id} />
            <TideCard userId={session.user.id} />
            <DriveCard userId={session.user.id} />

            {BOOKED_ACTIVITIES.map((activity) => (
              <BookedActivityCard
                key={activity.bookingRef ?? activity.name}
                activity={activity}
                userId={session.user.id}
              />
            ))}

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
                onClaim={checklist.claimItem}
                onUnclaim={checklist.unclaimItem}
                onAddItem={checklist.addCustomItem}
                onDeleteItem={checklist.deleteCustomItem}
                currentUserId={session.user.id}
                myFamilyId={profile.family_id}
                isAdmin={profile.is_admin}
              />
            ))}

            <PlacesSection userId={session.user.id} />
            <InfoPanel userId={session.user.id} />

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
