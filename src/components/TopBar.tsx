import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Shield, Home, Users as UsersIcon, Luggage, Wifi, WifiOff, RefreshCw, MessageCircle, Download, Newspaper, Search, X } from 'lucide-react';
import type { Profile, Family } from '@/types/db';
import { cx, firstName } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useOnline, useQueueSize } from '@/hooks/useOnline';

interface Props {
  profile: Profile;
  families: Family[];
  pendingCount: number;
  unreadMessages: number;
  onJumpToUnread: () => void;
  updateAvailable: boolean;
  onReload: () => void;
  appVersion: string | null;
  buildId: string | null;
  latestVersionTag: string | null;
  onShowReleaseNotes: () => void;
  currentTab: 'trip' | 'admin';
  onTabChange: (t: 'trip' | 'admin') => void;
  onPackMode: () => void;
  onSignOut: () => Promise<void>;
  filter: string;
  onFilterChange: (s: string) => void;
  filterMatchCount: number | null;
  showFilter: boolean;
}

export default function TopBar({
  profile, families, pendingCount, unreadMessages, onJumpToUnread,
  updateAvailable, onReload, appVersion, buildId, latestVersionTag, onShowReleaseNotes,
  currentTab, onTabChange, onPackMode, onSignOut,
  filter, onFilterChange, filterMatchCount, showFilter,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const online = useOnline();
  const pendingWrites = useQueueSize();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const myFamily = families.find((f) => f.id === profile.family_id);

  async function changeFamily(familyId: string) {
    await supabase.from('profiles').update({ family_id: familyId }).eq('id', profile.id);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 shadow-lg">
      <div className="relative overflow-hidden bg-gradient-to-br from-dusk-800 via-sunset-500 to-sunset-300 text-white">
       {/* Stylized palm tree silhouette in the upper-right corner.
           Leaning trunk + crown of fronds + coconut cluster. Decorative —
           hidden from screen readers, never blocks clicks. */}
       <svg
         viewBox="0 0 200 100"
         className="absolute top-0 right-1 sm:right-2 w-32 sm:w-40 h-auto text-dusk-900/40 pointer-events-none"
         aria-hidden="true"
       >
         <g fill="currentColor">
           {/* Trunk: gentle leftward lean, tapered toward the crown */}
           <path d="M 130,100 C 124,85 120,65 116,50 L 122,50 C 126,65 130,85 136,100 Z"/>
           {/* Coconut cluster tucked under the crown */}
           <circle cx="115" cy="56" r="2.5"/>
           <circle cx="121" cy="58" r="2"/>
           {/* Crown: 6 fronds spreading from the trunk top */}
           <g transform="translate(119 50)">
             <g transform="rotate(200)"><path d="M 0,0 C 0,-5 30,-3 60,0 C 30,3 0,5 0,0 Z"/></g>
             <g transform="rotate(230)"><path d="M 0,0 C 0,-5 28,-3 55,0 C 28,3 0,5 0,0 Z"/></g>
             <g transform="rotate(260)"><path d="M 0,0 C 0,-4 20,-3 40,0 C 20,3 0,4 0,0 Z"/></g>
             <g transform="rotate(290)"><path d="M 0,0 C 0,-4 22,-3 45,0 C 22,3 0,4 0,0 Z"/></g>
             <g transform="rotate(320)"><path d="M 0,0 C 0,-5 28,-3 55,0 C 28,3 0,5 0,0 Z"/></g>
             <g transform="rotate(350)"><path d="M 0,0 C 0,-5 30,-3 60,0 C 30,3 0,5 0,0 Z"/></g>
           </g>
         </g>
       </svg>
       <div className="relative max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl leading-none truncate drop-shadow-sm">
              Port A 2026 <span className="text-2xl md:text-3xl align-middle">🏖️</span>
            </h1>
            <p className="text-amber-50/85 text-xs mt-0.5">
              <span className="hidden sm:inline">May 25–29 · Family Trip</span>
              {appVersion && buildId && (
                <span className="text-amber-100/70 sm:ml-2 tabular-nums">
                  v{appVersion} ({buildId.slice(0, 7)})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {online ? (
              <span
                className="bg-emerald-500/90 text-white rounded-md px-2 py-1 text-xs flex items-center gap-1 font-medium"
                title="Connected — changes sync immediately"
              >
                <Wifi size={12} />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span
                className="bg-slate-700/60 text-white/90 rounded-md px-2 py-1 text-xs flex items-center gap-1 font-medium"
                title="No network — changes will sync when you reconnect"
              >
                <WifiOff size={12} />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
            {pendingWrites > 0 && (
              <span
                className="bg-amber-400/90 text-amber-900 rounded-md px-2 py-1 text-xs flex items-center gap-1 font-medium tabular-nums"
                title={`${pendingWrites} pending write${pendingWrites === 1 ? '' : 's'} waiting to sync`}
              >
                <RefreshCw size={12} className={online ? 'animate-spin' : ''} />
                <span>{pendingWrites}</span>
              </span>
            )}
            {unreadMessages > 0 && (
              <button
                type="button"
                onClick={onJumpToUnread}
                className="bg-coral-500 hover:bg-coral-600 text-white rounded-md px-2 py-1 text-xs flex items-center gap-1 font-medium tabular-nums transition"
                title={`${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'} — jump to the next one`}
              >
                <MessageCircle size={12} />
                <span>{unreadMessages > 99 ? '99+' : unreadMessages}</span>
              </button>
            )}
            {profile.is_admin && (
              <div className="flex bg-white/10 rounded-lg p-0.5 text-sm">
                <button
                  onClick={() => onTabChange('trip')}
                  className={cx(
                    'px-3 py-1.5 rounded-md flex items-center gap-1.5 transition',
                    currentTab === 'trip' ? 'bg-white text-ocean-700 font-medium' : 'text-white/80 hover:text-white',
                  )}
                >
                  <Home size={14} /> <span className="hidden sm:inline">Trip</span>
                </button>
                <button
                  onClick={() => onTabChange('admin')}
                  className={cx(
                    'px-3 py-1.5 rounded-md flex items-center gap-1.5 transition relative',
                    currentTab === 'admin' ? 'bg-white text-ocean-700 font-medium' : 'text-white/80 hover:text-white',
                  )}
                >
                  <Shield size={14} /> <span className="hidden sm:inline">Admin</span>
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-coral-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={onPackMode}
              className="bg-amber-400 hover:bg-amber-300 text-amber-900 rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5 font-medium transition shadow-sm"
              title="Pack mode — check off what you've packed"
            >
              <Luggage size={14} />
              <span className="hidden sm:inline">Pack</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1.5 transition"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-full border border-white/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                    {firstName(profile.display_name, profile.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <ChevronDown size={14} className="hidden sm:block" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <div className="font-medium text-sm">{profile.display_name ?? profile.email}</div>
                    <div className="text-xs text-slate-500 truncate">{profile.email}</div>
                    {myFamily && (
                      <div className="mt-2 text-xs text-ocean-700 bg-ocean-50 inline-flex items-center gap-1 px-2 py-1 rounded">
                        <UsersIcon size={11} /> {myFamily.display_name}
                      </div>
                    )}
                  </div>

                  <div className="p-2">
                    <div className="text-xs text-slate-500 px-2 py-1 uppercase tracking-wide">Change family</div>
                    {families.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => changeFamily(f.id)}
                        className={cx(
                          'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-50',
                          f.id === profile.family_id ? 'text-ocean-700 font-medium' : 'text-slate-700',
                        )}
                      >
                        {f.display_name}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={onSignOut}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
       </div>
       {showFilter && (
         <svg
           viewBox="0 0 1440 40"
           preserveAspectRatio="none"
           className="absolute bottom-0 left-0 w-full h-4 sm:h-5 text-white pointer-events-none"
           aria-hidden="true"
         >
           <path fill="currentColor" d="M0,20 C240,0 480,40 720,20 C960,0 1200,40 1440,20 L1440,40 L0,40 Z" />
         </svg>
       )}
      </div>
      {showFilter && (
        <div className="w-full bg-white border-t-0 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onFilterChange(''); }}
                placeholder="Filter items…"
                aria-label="Filter checklist items"
                className="w-full pl-9 pr-20 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200 focus:bg-white transition"
              />
              {filter.length > 0 && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {filterMatchCount !== null && (
                    <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">
                      {filterMatchCount} match{filterMatchCount === 1 ? '' : 'es'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onFilterChange('')}
                    aria-label="Clear filter"
                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {updateAvailable && (
        <div className="w-full bg-coral-600 text-white border-t-2 border-coral-700 flex items-stretch">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 hover:bg-coral-700 active:bg-coral-800 py-2.5 px-3 sm:px-4 flex items-center justify-center gap-2 text-sm font-semibold transition min-w-0"
            title="Reload the app to pick up the latest version"
          >
            <Download size={16} className="flex-shrink-0" />
            <span className="truncate">A new version is available — tap to update</span>
          </button>
          {latestVersionTag && latestVersionTag !== 'dev' && (
            <button
              type="button"
              onClick={onShowReleaseNotes}
              className="flex hover:bg-coral-700 active:bg-coral-800 py-2.5 px-3 sm:px-4 items-center gap-1.5 border-l-2 border-coral-700 text-sm font-semibold transition flex-shrink-0 underline underline-offset-2 decoration-coral-200"
              title="See what's new in this update"
            >
              <Newspaper size={15} />
              <span>What's new</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}


