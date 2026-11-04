import type { ActivityCategory } from "~/generated/prisma/enums";

export const ACTIVITY_CATEGORIES = [
  "ICE_SKATING",
  "PINBALL",
  "ARCADE",
  "BOWLING",
  "DARTS",
  "DANCING",
  "LIVE_MUSIC",
  "TRIVIA",
  "KARAOKE",
  "COMEDY",
  "THEATER",
  "MOVIES",
  "GAMES",
  "OUTDOORS",
  "OTHER",
] as const satisfies readonly ActivityCategory[];

export const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; emoji: string; /** Tailwind classes for the badge */ tone: string }
> = {
  ICE_SKATING: { label: "Ice skating", emoji: "⛸️", tone: "bg-sky-100 text-sky-800" },
  PINBALL: { label: "Pinball", emoji: "🕹️", tone: "bg-fuchsia-100 text-fuchsia-800" },
  ARCADE: { label: "Arcade", emoji: "👾", tone: "bg-violet-100 text-violet-800" },
  BOWLING: { label: "Bowling", emoji: "🎳", tone: "bg-amber-100 text-amber-800" },
  DARTS: { label: "Darts", emoji: "🎯", tone: "bg-red-100 text-red-800" },
  DANCING: { label: "Dancing", emoji: "💃", tone: "bg-pink-100 text-pink-800" },
  LIVE_MUSIC: { label: "Live music", emoji: "🎸", tone: "bg-indigo-100 text-indigo-800" },
  TRIVIA: { label: "Trivia", emoji: "🧠", tone: "bg-emerald-100 text-emerald-800" },
  KARAOKE: { label: "Karaoke", emoji: "🎤", tone: "bg-rose-100 text-rose-800" },
  COMEDY: { label: "Comedy", emoji: "😂", tone: "bg-yellow-100 text-yellow-800" },
  THEATER: { label: "Theater", emoji: "🎭", tone: "bg-purple-100 text-purple-800" },
  MOVIES: { label: "Movies", emoji: "🎬", tone: "bg-slate-200 text-slate-800" },
  GAMES: { label: "Games & play", emoji: "🎲", tone: "bg-teal-100 text-teal-800" },
  OUTDOORS: { label: "Outdoors", emoji: "🌲", tone: "bg-green-100 text-green-800" },
  OTHER: { label: "Other", emoji: "✨", tone: "bg-stone-200 text-stone-800" },
};

export function categoryLabel(c: ActivityCategory | null | undefined): string {
  return c ? CATEGORY_META[c].label : "";
}

export function isActivityCategory(s: unknown): s is ActivityCategory {
  return typeof s === "string" && (ACTIVITY_CATEGORIES as readonly string[]).includes(s);
}
