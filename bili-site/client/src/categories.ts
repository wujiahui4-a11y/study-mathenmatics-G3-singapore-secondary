import {
  Flame,
  GraduationCap,
  Cpu,
  Gamepad2,
  Music,
  Clapperboard,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";

export interface Category {
  rid: number;
  label: string;
  icon: typeof Flame;
  paginated?: boolean;
}

// "Catalog" of Bilibili zones. rid 36 is the Knowledge / Study zone.
export const CATEGORIES: Category[] = [
  { rid: 0, label: "Trending", icon: Flame, paginated: true },
  { rid: 36, label: "Study", icon: GraduationCap },
  { rid: 188, label: "Tech", icon: Cpu },
  { rid: 4, label: "Gaming", icon: Gamepad2 },
  { rid: 3, label: "Music", icon: Music },
  { rid: 1, label: "Anime", icon: Clapperboard },
  { rid: 211, label: "Food", icon: UtensilsCrossed },
  { rid: 5, label: "Entertainment", icon: Sparkles },
];

export function categoryByRid(rid: number): Category {
  return CATEGORIES.find((c) => c.rid === rid) ?? CATEGORIES[0];
}
