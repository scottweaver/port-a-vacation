import { useState } from 'react';
import { Home, ExternalLink, KeyRound, Waves, Wifi, Phone, Clock, Bike, MapPin, Eye, EyeOff } from 'lucide-react';
import type { CondoInfo } from '@/types/db';
import CollapsibleCard from './CollapsibleCard';

const PORTAL_URL = import.meta.env.VITE_CONDO_PORTAL_URL;

interface Props {
  userId: string;
  info: CondoInfo | null;
}

export default function CondoPortalCard({ userId, info }: Props) {
  return (
    <CollapsibleCard
      storageKey="condo-portal"
      userId={userId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Home size={20} className="text-coral-500" />
            Condo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">1900 S 11th St, Port Aransas</p>
        </>
      }
    >
      <div className="space-y-4">
        {(info?.door_code || info?.pool_code) && (
          <div className="grid grid-cols-2 gap-3">
            {info.door_code && <CodeTile icon={KeyRound} label="Door Code" value={info.door_code} accent="coral" secret />}
            {info.pool_code && <CodeTile icon={Waves} label="Pool Code" value={info.pool_code} accent="ocean" secret />}
          </div>
        )}

        {(info?.wifi_ssid || info?.wifi_password) && (
          <InfoRow icon={Wifi} label="Wifi">
            {info.wifi_ssid && <div className="text-slate-700"><span className="text-slate-500 text-xs">SSID:</span> {info.wifi_ssid}</div>}
            {info.wifi_password && (
              <div className="text-slate-700 flex items-center gap-2">
                <span className="text-slate-500 text-xs">Password:</span>
                <Secret value={info.wifi_password} variant="inline" />
              </div>
            )}
          </InfoRow>
        )}

        {(info?.host_name || info?.host_phone) && (
          <InfoRow icon={Phone} label="Host">
            <div className="text-slate-700 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {info.host_name && <span>{info.host_name}</span>}
              {info.host_phone && (
                <a href={`tel:${info.host_phone.replace(/[^\d+]/g, '')}`} className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2">
                  {info.host_phone}
                </a>
              )}
            </div>
          </InfoRow>
        )}

        {(info?.check_in_time || info?.check_out_time) && (
          <InfoRow icon={Clock} label="Times">
            <div className="text-slate-700 flex flex-wrap gap-x-4 gap-y-0.5">
              {info.check_in_time && <span><span className="text-slate-500 text-xs">In:</span> {info.check_in_time}</span>}
              {info.check_out_time && <span><span className="text-slate-500 text-xs">Out:</span> {info.check_out_time}</span>}
            </div>
          </InfoRow>
        )}

        {(info?.bike_rental_name || info?.bike_rental_address || info?.bike_rental_phone) && (
          <RentalRow
            icon={Bike}
            label="Bike Rental"
            name={info.bike_rental_name}
            address={info.bike_rental_address}
            phone={info.bike_rental_phone}
          />
        )}

        {(info?.golf_cart_name || info?.golf_cart_address || info?.golf_cart_phone) && (
          <RentalRow
            icon={CartIcon}
            label="Golf Cart"
            name={info.golf_cart_name}
            address={info.golf_cart_address}
            phone={info.golf_cart_phone}
          />
        )}

        {info?.notes && (
          <div className="text-sm text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-3">
            {info.notes}
          </div>
        )}

        {PORTAL_URL ? (
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-coral-500 hover:bg-coral-600 text-white font-medium text-sm transition w-full sm:w-auto justify-center"
          >
            Open guest portal
            <ExternalLink size={14} />
          </a>
        ) : (
          <p className="text-xs text-slate-400 italic">Portal link not configured.</p>
        )}
      </div>
    </CollapsibleCard>
  );
}

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

function CodeTile({ icon: Icon, label, value, accent, secret = false }: {
  icon: IconType;
  label: string;
  value: string;
  accent: 'coral' | 'ocean';
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const wrap = accent === 'coral'
    ? 'bg-gradient-to-br from-coral-50 to-sunset-50 border-coral-100'
    : 'bg-gradient-to-br from-ocean-50 to-cyan-50 border-ocean-100';
  const iconCls = accent === 'coral' ? 'text-coral-600' : 'text-ocean-600';
  const shown = !secret || revealed;
  return (
    <div className={`rounded-xl border p-3 ${wrap}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <Icon size={14} className={iconCls} />
          {label}
        </span>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
            title={revealed ? 'Hide' : 'Reveal'}
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800 tracking-wider font-mono select-all">
        {shown ? value : '•'.repeat(Math.max(value.length, 4))}
      </div>
    </div>
  );
}

// Inline reveal — used for wifi password inside the Wifi info row.
function Secret({ value, variant }: { value: string; variant: 'inline' }) {
  const [revealed, setRevealed] = useState(false);
  // variant is reserved for future expansion (e.g. block-level secret rows);
  // currently only 'inline' is implemented.
  void variant;
  return (
    <>
      <code className="font-mono select-all">
        {revealed ? value : '•'.repeat(Math.max(value.length, 6))}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
        title={revealed ? 'Hide' : 'Reveal'}
        aria-label={revealed ? 'Hide password' : 'Reveal password'}
      >
        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: IconType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <div className="flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function RentalRow({ icon: Icon, label, name, address, phone }: {
  icon: IconType;
  label: string;
  name: string | null;
  address: string | null;
  phone: string | null;
}) {
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  return (
    <InfoRow icon={Icon} label={label}>
      <div className="space-y-0.5">
        {name && <div className="text-slate-700 font-medium">{name}</div>}
        {address && mapsHref && (
          <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-700 underline underline-offset-2">
            <MapPin size={12} />
            {address}
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="block text-xs text-ocean-600 hover:text-ocean-700 underline underline-offset-2">
            {phone}
          </a>
        )}
      </div>
    </InfoRow>
  );
}

// lucide-react doesn't ship a golf-cart icon; this is a minimal stylized cart
// silhouette (canopy + body + two wheels) drawn to match Lucide's 24x24 + 2px
// stroke convention.
function CartIcon({ size = 16, className = '' }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 8h11l3 4h4" />
      <path d="M3 8v6h17" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
