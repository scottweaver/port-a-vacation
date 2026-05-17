import { useCallback, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/db';
import { useFamilies } from '@/hooks/useFamilies';
import { useChecklist } from '@/hooks/useChecklist';
import { useProfiles } from '@/hooks/useProfiles';
import { useAdmin } from '@/hooks/useAdmin';
import { usePacking } from '@/hooks/usePacking';
import { useHiddenItems } from '@/hooks/useHiddenItems';
import { useConversations } from '@/hooks/useConversations';
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
import ConversationModal from './ConversationModal';

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
  const [activeChatItemId, setActiveChatItemId] = useState<string | null>(null);

  const { families } = useFamilies();
  const profiles = useProfiles(true);
  const checklist = useChecklist(session.user.id);
  const admin = useAdmin(profile.is_admin, session.user.id);
  const packing = usePacking(session.user.id, profile.family_id);
  const hiddenItems = useHiddenItems(session.user.id, profile.family_id);
  const conversations = useConversations(session.user.id);

  const familyById = useMemo(
    () => new Map(families.map((f) => [f.id, f])),
    [families],
  );

  function handleOpenChat(itemId: string) {
    setActiveChatItemId(itemId);
    conversations.markRead(itemId);
    void conversations.loadThread(itemId);
  }

  const activeChatItem = activeChatItemId
    ? checklist.items.find((i) => i.id === activeChatItemId) ?? null
    : null;

  const totalUnread = useMemo(() => {
    let total = 0;
    for (const n of conversations.unreadByItem.values()) total += n;
    return total;
  }, [conversations.unreadByItem]);

  const unreadByCategory = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of checklist.items) {
      const n = conversations.unreadByItem.get(item.id) ?? 0;
      if (n > 0) result.set(item.category, (result.get(item.category) ?? 0) + n);
    }
    return result;
  }, [checklist.items, conversations.unreadByItem]);

  // Items in the same order they render — category sort_order then within-
  // category sort_order. Drives the round-robin cursor for "jump to next
  // unread message."
  const sortedItems = useMemo(() => {
    return [...checklist.items].sort((a, b) => {
      const ca = CATEGORIES.findIndex((c) => c.key === a.category);
      const cb = CATEGORIES.findIndex((c) => c.key === b.category);
      if (ca !== cb) return ca - cb;
      return a.sort_order - b.sort_order;
    });
  }, [checklist.items]);

  // Cursor per scope ('all' for the top-bar jump button, or a category key
  // for per-category jumps). Stored in a ref because it's read-only state
  // for the click handler — we don't want re-renders on cursor updates.
  const jumpCursorRef = useRef<Map<string, string>>(new Map());

  const jumpToNextUnread = useCallback((scope: 'all' | string) => {
    const candidates = scope === 'all'
      ? sortedItems
      : sortedItems.filter((i) => i.category === scope);
    const unread = candidates.filter((i) => (conversations.unreadByItem.get(i.id) ?? 0) > 0);
    if (unread.length === 0) return;

    const lastId = jumpCursorRef.current.get(scope);
    let nextIdx = 0;
    if (lastId) {
      const lastIdx = unread.findIndex((i) => i.id === lastId);
      if (lastIdx >= 0) nextIdx = (lastIdx + 1) % unread.length;
    }
    const target = unread[nextIdx];
    if (!target) return;

    jumpCursorRef.current.set(scope, target.id);

    // Expand the target's category if collapsed, then scroll on the next
    // frame so the row is laid out by the time we call scrollIntoView.
    window.dispatchEvent(new CustomEvent('collapsible:expand', {
      detail: { storageKey: `cat:${target.category}` },
    }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-${target.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [sortedItems, conversations.unreadByItem]);

  if (mode === 'pack' && profile.family_id) {
    const myFamily = familyById.get(profile.family_id);
    if (myFamily) {
      return (
        <PackView
          items={checklist.items}
          contributions={checklist.contributions}
          packed={packing.packed}
          hidden={hiddenItems.hidden}
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
        unreadMessages={totalUnread}
        onJumpToUnread={() => jumpToNextUnread('all')}
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
                hidden={hiddenItems.hidden}
                getContribution={checklist.getContribution}
                onAdjustQuantity={checklist.adjustQuantity}
                onToggleTask={checklist.toggleTask}
                onClaim={checklist.claimItem}
                onUnclaim={checklist.unclaimItem}
                onAddItem={checklist.addCustomItem}
                onDeleteItem={checklist.deleteCustomItem}
                onHide={hiddenItems.hideItem}
                onUnhide={hiddenItems.unhideItem}
                onOpenChat={handleOpenChat}
                unreadByItem={conversations.unreadByItem}
                messageCountByItem={conversations.messageCountByItem}
                unreadCategory={unreadByCategory.get(cat.key) ?? 0}
                onJumpInCategory={() => jumpToNextUnread(cat.key)}
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

      {activeChatItem && (
        <ConversationModal
          item={activeChatItem}
          messages={conversations.threads.get(activeChatItem.id) ?? []}
          isLoaded={conversations.threads.has(activeChatItem.id)}
          profiles={profiles}
          currentUserId={session.user.id}
          onClose={() => setActiveChatItemId(null)}
          onPost={conversations.postMessage}
          onEdit={conversations.editMessage}
          onDelete={conversations.deleteMessage}
        />
      )}
    </div>
  );
}
