import type { LucideIcon } from 'lucide-react';
import { Sun, Cloud, CloudRain, CloudSun, CloudDrizzle } from 'lucide-react';

export const TRIP_START = new Date('2026-05-25T08:00:00-05:00');
export const TRIP_END = new Date('2026-05-29T12:00:00-05:00');

export const CONDO_ADDRESS = '1900 S 11th St, Port Aransas, TX 78373';
export const ORIGIN = 'Austin, TX';

export type Condition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain' | 'drizzle';

export const conditionIcon: Record<Condition, LucideIcon> = {
  sunny: Sun,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  drizzle: CloudDrizzle,
};

export const conditionLabel: Record<Condition, string> = {
  sunny: 'Sunny',
  'partly-cloudy': 'Partly Cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  drizzle: 'Drizzle',
};

export interface DayForecast {
  date: string;
  day: string;
  high: number;
  low: number;
  condition: Condition;
  rainChance: number;
  note: string;
}

export const WEATHER_FORECAST: DayForecast[] = [
  { date: 'Mon May 25', day: 'Day 1', high: 84, low: 74, condition: 'partly-cloudy', rainChance: 20, note: 'Arrival day' },
  { date: 'Tue May 26', day: 'Day 2', high: 85, low: 75, condition: 'sunny',         rainChance: 10, note: 'Best beach day' },
  { date: 'Wed May 27', day: 'Day 3', high: 86, low: 76, condition: 'sunny',         rainChance: 15, note: 'Beach / activities' },
  { date: 'Thu May 28', day: 'Day 4', high: 84, low: 75, condition: 'partly-cloudy', rainChance: 25, note: 'Watch afternoon storms' },
  { date: 'Fri May 29', day: 'Day 5', high: 83, low: 74, condition: 'partly-cloudy', rainChance: 30, note: 'Departure day' },
];

export interface TideDay {
  date: string;
  highs: string[];
  lows: string[];
  best: string;
}

export const TIDE_FORECAST: TideDay[] = [
  { date: 'Mon May 25', highs: ['6:12 AM', '7:42 PM'], lows: ['1:08 PM'], best: 'Morning shelling 5–7am' },
  { date: 'Tue May 26', highs: ['7:01 AM', '8:28 PM'], lows: ['1:54 PM'], best: 'Morning swim before high tide' },
  { date: 'Wed May 27', highs: ['7:48 AM', '9:11 PM'], lows: ['2:38 PM'], best: 'Afternoon swim at low tide' },
  { date: 'Thu May 28', highs: ['8:33 AM', '9:52 PM'], lows: ['3:21 PM'], best: 'Afternoon shelling' },
  { date: 'Fri May 29', highs: ['9:17 AM', '10:31 PM'], lows: ['4:03 PM'], best: 'Pack up by noon' },
];

export interface DriveStop {
  name: string;
  time: string;
  note: string;
}

export const DRIVE_DISTANCE_MILES = 215;
export const DRIVE_DURATION_HOURS = 3.5;
export const DRIVE_ROUTE_SUMMARY = 'via US-183 S / US-77 S / TX-361';

export const DRIVE_STOPS: DriveStop[] = [
  { name: 'Austin (Start)',      time: '0:00', note: 'Top off gas, last bathroom break for everyone' },
  { name: "Buc-ee's, Luling",    time: '0:50', note: "I-10 exit 632. Bathrooms, beaver nuggets, brisket sandwiches. Classic stop." },
  { name: 'Refugio (optional)',  time: '2:20', note: 'Halfway point if anyone needs to stop. Small town, basic options.' },
  { name: 'H-E-B Aransas Pass',  time: '3:10', note: 'Last big grocery store before the ferry. Stock up on condo supplies.' },
  { name: 'Port Aransas Ferry',  time: '3:25', note: 'Free ferry — can have 20+ min wait in peak season. Stay in car.' },
  { name: '1900 S 11th St Condo',time: '3:40', note: 'Arrival! Check-in usually 4pm.' },
];

export interface Place {
  name: string;
  type: string;
  rating: number;
  reviewCount?: number;
  address?: string;
  phone?: string | null;
  note: string;
}

export const RESTAURANTS: Place[] = [
  { name: "MacDaddy's Family Kitchen", type: 'BBQ & Family',    rating: 4.3, reviewCount: 3686, address: '118 Beach St',   phone: '(361) 749-2271', note: 'Great BBQ with coastal vibes. Outdoor seating with shade & fans. Kid-friendly.' },
  { name: "Virginia's On the Bay",     type: 'Seafood',         rating: 4.0, reviewCount: 4716, address: '815 Trout St',   phone: '(361) 749-4088', note: 'Waterfront views, dolphins & birds. Expect long waits at peak times — go early.' },
  { name: 'Seafood & Spaghetti Works', type: 'Seafood & Italian',rating: 4.4, reviewCount: 4272, address: '910 TX-361',     phone: '(361) 749-5666', note: "Best-rated family option. They'll cook your fresh catch." },
  { name: 'FINS Grill & Icehouse',     type: 'Seafood & Burgers',rating: 4.3, reviewCount: 4716, address: '420 W Cotter Ave', phone: '(361) 749-8646', note: 'Patio overlooks the boats. Great for sunset.' },
  { name: 'Grumbles Seafood Co.',      type: 'Seafood',         rating: 4.0, reviewCount: 1507, address: '850 Tarpon St',  phone: '(361) 749-1990', note: 'Order-before-you-sit setup. Right on the water.' },
];

export const ACTIVITIES: Place[] = [
  { name: 'Red Dragon Pirate Cruises',     type: 'Pirate ship cruise',  rating: 4.6, reviewCount: 944,  phone: '(361) 749-2469', note: 'Big hit with kids 3–13. Crew keeps everyone engaged. Sunset cruises see dolphins.' },
  { name: 'Roberts Point Park',            type: 'Park & ferry viewing',rating: 4.7, reviewCount: 3077, phone: '(361) 749-4111', note: 'Free. Watch dolphins, ferries, ships. Padded playground, observation tower.' },
  { name: 'The Patton Center',             type: 'Marine aquarium (FREE)',rating: 4.8, reviewCount: 105, phone: null,            note: 'Small but excellent aquariums + wetlands trail. Tue–Sat, 10am–4pm.' },
  { name: "Chute 'Em Up Parasailing",      type: 'Parasailing',         rating: 4.9, reviewCount: 883,  phone: '(361) 774-5792', note: 'Ages 8+. Highly safety-conscious, customizable rides. Excellent reviews.' },
  { name: 'Port Aransas Tiki Boat Tours',  type: 'Shelling & sightseeing',rating: 4.9, reviewCount: 19,  phone: '(361) 205-7707', note: 'Captain Moon takes you shelling, dolphin watching, lighthouse views.' },
];

// =============================================================================
// On-island essentials — things you can grab without taking the ferry back to
// the mainland. Static data; family member requested this in v3.10. Restaurants
// live in RESTAURANTS above (different vibe — "where should we eat tonight").
// =============================================================================

export interface OnIslandEssential {
  emoji: string;
  category: string;
  name: string;
  address: string;
  phone: string | null;
  hours?: string;
  note: string;
}

export const ON_ISLAND_ESSENTIALS: OnIslandEssential[] = [
  {
    emoji: '🛒',
    category: 'Grocery',
    name: "Lowe's Market",
    address: '418 S Alister St',
    phone: '(361) 749-6233',
    note: "The only grocery store on the island. Used to be Family Center IGA — same building, new owners as of 2025.",
  },
  {
    emoji: '🔧',
    category: 'Hardware',
    name: 'Ace Hardware',
    address: '1115 SH-361, Ste A',
    phone: '(361) 749-2004',
    hours: 'Mon–Sat 8am–6pm · Sun 9am–5pm',
    note: 'Beach gear, propane, paint, key cutting, glass cutting.',
  },
  {
    emoji: '⛽',
    category: 'Gas',
    name: 'Valero',
    address: '3501 SH-361',
    phone: null,
    note: "On-island gas. Also sells the city's $12 beach parking permit.",
  },
  {
    emoji: '🐟',
    category: 'Bait & Tackle',
    name: 'Island Tackle',
    address: '207 W Ave G',
    phone: '(361) 749-1744',
    hours: 'Mon 8am–5pm · Tue–Sat 7:30am–6pm',
    note: 'Bait, tackle, rod + reel rental & repair. Surf, jetty, pier, or boat gear.',
  },
  {
    emoji: '💊',
    category: 'Pharmacy',
    name: 'CVS Pharmacy',
    address: '710 SH-361',
    phone: '(361) 749-2277',
    note: 'Prescriptions, immunizations, sundries. Has a drive-thru window.',
  },
  {
    emoji: '🍺',
    category: 'Liquor',
    name: "Spanky's Liquor",
    address: '501 S Alister St',
    phone: '(361) 749-6994',
    hours: 'Daily 10am–9pm',
    note: 'Beer, wine, liquor, cigars. Central location on Alister.',
  },
  {
    emoji: '☕',
    category: 'Coffee',
    name: 'Coffee Waves',
    address: '1007 SH-361',
    phone: null,
    note: 'Iconic local — handcrafted espresso, iced coffee, gelato. Indie bookstore inside.',
  },
];

export interface BookedActivity {
  emoji: string;
  name: string;
  vendor: string;
  bookingRef: string | null;
  phone: string | null;
  date: string;
  startTime: string;
  endTime: string;
  party: string;
  address: string;
  parkingNote: string;
  checkIn: string;
}

export const BOOKED_ACTIVITIES: BookedActivity[] = [
  {
    emoji: '🏴‍☠️',
    name: 'Pirate Ship Cruise',
    vendor: 'Red Dragon Pirate Cruises',
    bookingRef: '347244120',
    phone: '(361) 749-2469',
    date: 'Wed May 27, 2026',
    startTime: '11:30 AM',
    endTime: '2:00 PM',
    party: '7 adults, 2 children',
    address: '440 W. Cotter Ave, Port Aransas, TX',
    parkingNote: 'Park under the Red Dragon Pirate Cruises sign in the chained-off section. Pull all the way forward to the front of the lane or behind another vehicle.',
    checkIn: 'Arrive no later than 11:30 AM — this is the scheduled cruise time, NOT the departure time. Check in to get your boarding pass, then wait on the dock until boarding begins.',
  },
];

export interface InfoTile {
  icon: string;
  title: string;
  body: string;
  sources?: { label: string; href: string }[];
}

export const INFO_TILES: InfoTile[] = [
  { icon: '🅿️', title: 'Beach Parking Permit', body: '$12 annual pass. Buy at any Stripes or Valero gas station on Hwy 361 before crossing the ferry. Required to park on the beach itself.' },
  { icon: '⛴️', title: 'Ferry',                 body: 'Free, runs 24/7. Can have 20–30 min waits in peak season. Stay in your car.' },
  { icon: '🪼', title: 'Jellyfish',             body: "Moon jellies are common — mild sting. Pack vinegar or sting relief. Avoid Portuguese man o' war (rare, blue/purple)." },
  { icon: '🏖️', title: 'Beach Driving',         body: 'You can drive & park right on the beach. Watch for soft sand near dunes. 4WD not required on hard-packed area.' },
  {
    icon: '🛺',
    title: 'Golf Cart',
    body: "Licensed driver only (16+ with valid DL) — Isaac, Cordelia, and Kai can't drive it. Everyone seated with a seat belt; no laps, no standing, no riding on the back. 15 mph speed limit on the beach — it's treated as a city street. Same $12 beach permit covers parking it on the sand. Hard-packed sand only; stay off the dunes and vegetation. DWI and open-container laws apply just like a car. No sidewalks, parks, or playgrounds. Lights on at dusk.",
    sources: [
      { label: 'City rules', href: 'https://cityofportaransas.org/golf-cart-information-and-regulations/' },
      { label: 'Beach cart rules', href: 'https://www.portaransas.org/things-to-do/beach-cart-rentals/beach-cart-rules/' },
    ],
  },
  { icon: '🛒', title: 'Grocery',               body: 'H-E-B in Aransas Pass (before ferry) is the biggest. Smaller H-E-B in Ingleside. Stock up before the island.' },
  { icon: '📞', title: 'Emergency',             body: 'Port Aransas Police: (361) 749-6241 · Urgent care: CHRISTUS Spohn (Corpus Christi, ~30 min)' },
];

export interface CategoryMeta {
  key: string;
  title: string;
  emoji: string;
  description: string;
  scope: 'shared' | 'per-family';
  /** Tailwind bg-class for the per-category color stripe at the top of
   *  the card. Full class names so the Tailwind JIT scanner picks them up. */
  tint: string;
  /** Tailwind from-class for the faint diagonal gradient wash on the card
   *  body. Matches the stripe color at low opacity. */
  tintFade: string;
  /** Tailwind colored-shadow class so the stripe casts a soft glow of its
   *  own color downward into the card body. Combined with `shadow-md` on
   *  the stripe element. */
  tintShadow: string;
}

// Tints are a coordinated Gulf-coastal palette: warm sunset/coral families,
// with ocean blue for the literal beach card and muted sage/lavender/slate
// for scope variety. Each color appears once — restraint over disco.
export const CATEGORIES: CategoryMeta[] = [
  { key: 'beach',     title: 'Beach Essentials',     emoji: '🏖️', description: 'Shared gear — how many of each across all families?',              scope: 'shared',     tint: 'bg-gradient-to-r from-ocean-400 to-ocean-400/40',     tintFade: 'from-ocean-400/25',   tintShadow: 'shadow-ocean-400/40' },
  { key: 'clothing',  title: 'Clothing',             emoji: '👕', description: 'Each family packs their own. Quantities reflect total items.',     scope: 'per-family', tint: 'bg-gradient-to-r from-coral-400 to-coral-400/40',     tintFade: 'from-coral-400/25',   tintShadow: 'shadow-coral-400/40' },
  { key: 'car',       title: 'Car Prep',             emoji: '🚗', description: 'Each family checks off their own car before leaving Austin.',      scope: 'per-family', tint: 'bg-gradient-to-r from-slate-400 to-slate-400/40',     tintFade: 'from-slate-400/25',   tintShadow: 'shadow-slate-400/40' },
  { key: 'house',     title: 'House Close-Up',       emoji: '🏠', description: 'Each family closes up their own house — everyone sees progress.',  scope: 'per-family', tint: 'bg-gradient-to-r from-sunset-400 to-sunset-400/40',   tintFade: 'from-sunset-400/25',  tintShadow: 'shadow-sunset-400/40' },
  { key: 'kitchen',   title: 'Kitchen',              emoji: '🍳', description: 'Cookware, utensils, pantry staples shared at the condo.',          scope: 'shared',     tint: 'bg-gradient-to-r from-sage-400 to-sage-400/40',       tintFade: 'from-sage-400/25',    tintShadow: 'shadow-sage-400/40' },
  { key: 'games',     title: 'Games & Entertainment',emoji: '🎲', description: 'Board games, cards, devices — anything for downtime.',             scope: 'shared',     tint: 'bg-gradient-to-r from-lavender-400 to-lavender-400/40', tintFade: 'from-lavender-400/25',tintShadow: 'shadow-lavender-400/40' },
  { key: 'documents', title: 'Documents & Misc',     emoji: '📋', description: 'IDs, permits, cash, electronics.',                                  scope: 'shared',     tint: 'bg-gradient-to-r from-sunset-300 to-sunset-300/40',   tintFade: 'from-sunset-300/25',  tintShadow: 'shadow-sunset-300/40' },
];

export const categoryByKey: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);


