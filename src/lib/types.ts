import type {
  ActivityCategory,
  Confidence,
  RecordSource,
  VenueType,
  Weekday,
} from "~/generated/prisma/enums";
import type { IsoDate } from "./dates";

/** Serializable venue summary attached to every deal/event row sent to the client. */
export type VenueSummary = {
  id: number;
  slug: string;
  name: string;
  type: VenueType;
  category: ActivityCategory | null;
  cuisine: string | null;
  address: string | null;
  neighborhood: string | null;
  website: string | null;
  weeklyAdUrl: string | null;
  description: string | null;
};

export type DealItem = {
  id: number;
  title: string;
  description: string | null;
  days: Weekday[];
  startTime: string | null;
  endTime: string | null;
  priceText: string | null;
  validFrom: IsoDate | null;
  validTo: IsoDate | null;
  sourceUrl: string | null;
  confidence: Confidence;
  source: RecordSource;
  lastVerifiedAt: string | null;
  venue: VenueSummary;
};

export type EventItem = {
  id: number;
  category: ActivityCategory;
  title: string;
  description: string | null;
  recurring: boolean;
  days: Weekday[];
  date: IsoDate | null;
  startTime: string | null;
  endTime: string | null;
  priceText: string | null;
  sourceUrl: string | null;
  confidence: Confidence;
  source: RecordSource;
  lastVerifiedAt: string | null;
  venue: VenueSummary;
};

/** Everything happening on one calendar day. */
export type DayBoard = {
  date: IsoDate;
  restaurantDeals: DealItem[];
  groceryDeals: DealItem[];
  events: EventItem[];
};

export type WeekBoard = {
  start: IsoDate;
  today: IsoDate;
  days: DayBoard[];
};
