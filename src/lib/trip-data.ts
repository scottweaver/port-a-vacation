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
}

export const INFO_TILES: InfoTile[] = [
  { icon: '🅿️', title: 'Beach Parking Permit', body: '$12 annual pass. Buy at any Stripes or Valero gas station on Hwy 361 before crossing the ferry. Required to park on the beach itself.' },
  { icon: '⛴️', title: 'Ferry',                 body: 'Free, runs 24/7. Can have 20–30 min waits in peak season. Stay in your car.' },
  { icon: '🪼', title: 'Jellyfish',             body: "Moon jellies are common — mild sting. Pack vinegar or sting relief. Avoid Portuguese man o' war (rare, blue/purple)." },
  { icon: '🏖️', title: 'Beach Driving',         body: 'You can drive & park right on the beach. Watch for soft sand near dunes. 4WD not required on hard-packed area.' },
  { icon: '🛒', title: 'Grocery',               body: 'H-E-B in Aransas Pass (before ferry) is the biggest. Smaller H-E-B in Ingleside. Stock up before the island.' },
  { icon: '📞', title: 'Emergency',             body: 'Port Aransas Police: (361) 749-6241 · Urgent care: CHRISTUS Spohn (Corpus Christi, ~30 min)' },
];

export interface CategoryMeta {
  key: string;
  title: string;
  emoji: string;
  description: string;
  scope: 'shared' | 'per-family';
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'beach',     title: 'Beach Essentials', emoji: '🏖️', description: 'Shared gear — how many of each across all families?',              scope: 'shared' },
  { key: 'clothing',  title: 'Clothing',         emoji: '👕', description: 'Each family packs their own. Quantities reflect total items.',     scope: 'per-family' },
  { key: 'car',       title: 'Car Prep',         emoji: '🚗', description: 'Each family checks off their own car before leaving Austin.',      scope: 'per-family' },
  { key: 'house',     title: 'House Close-Up',   emoji: '🏠', description: 'Each family closes up their own house — everyone sees progress.',  scope: 'per-family' },
  { key: 'documents', title: 'Documents & Misc', emoji: '📋', description: 'IDs, permits, cash, electronics.',                                  scope: 'shared' },
];

export const categoryByKey: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);


