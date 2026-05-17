import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Shield, Home, Users as UsersIcon, Luggage, Wifi, WifiOff, RefreshCw, MessageCircle } from 'lucide-react';
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
  currentTab: 'trip' | 'admin';
  onTabChange: (t: 'trip' | 'admin') => void;
  onPackMode: () => void;
  onSignOut: () => Promise<void>;
}

export default function TopBar({
  profile, families, pendingCount, unreadMessages, onJumpToUnread,
  currentTab, onTabChange, onPackMode, onSignOut,
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
    <header className="bg-gradient-to-r from-ocean-600 via-ocean-500 to-teal-500 text-white shadow-lg sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Port A 2026 🏖️</h1>
            <p className="text-ocean-100 text-xs hidden sm:block">May 25–29 · Family Trip</p>
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
    </header>
  );
}


