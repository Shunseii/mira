/**
 * Icons a group can use, as stable string keys stored on the synced group row.
 *
 * Keys are Lucide names as of when they were added, but they are *our* keys:
 * the app maps each one to a bundled component, so an upstream rename only
 * touches that map, never stored data. Keys are append-only — never rename or
 * remove one, because other devices may already have synced it.
 *
 * A device running an older build may receive a key it doesn't know yet; see
 * `isGroupIcon` and the fallback in the app.
 */
export const GROUP_ICON_SECTIONS = [
  { id: "produce", label: "Produce", icons: ["carrot", "apple", "banana", "cherry", "citrus", "grape", "salad", "leafy-green", "sprout", "leaf", "bean", "nut"] },
  { id: "bakery", label: "Bakery", icons: ["croissant", "wheat", "sandwich", "pizza", "cake-slice", "cake", "cookie", "donut"] },
  { id: "dairy", label: "Dairy & eggs", icons: ["milk", "egg", "egg-fried", "ice-cream-cone", "ice-cream-bowl"] },
  { id: "meat", label: "Meat & fish", icons: ["beef", "drumstick", "ham", "fish", "shrimp"] },
  { id: "drinks", label: "Drinks", icons: ["coffee", "cup-soda", "glass-water", "droplet", "wine", "beer"] },
  { id: "pantry", label: "Pantry", icons: ["soup", "cooking-pot", "chef-hat", "utensils", "flame", "package", "popcorn"] },
  { id: "sweets", label: "Sweets", icons: ["candy", "candy-cane", "lollipop", "popsicle", "dessert"] },
  { id: "frozen", label: "Frozen", icons: ["snowflake", "refrigerator", "thermometer-snowflake"] },
  {
    id: "household",
    label: "Household",
    icons: ["spray-can", "sparkles", "washing-machine", "shirt", "trash", "toilet", "bath", "shower-head", "lightbulb", "battery", "wrench", "hammer", "paintbrush", "scissors", "house"],
  },
  { id: "care", label: "Health & care", icons: ["pill", "tablets", "heart-pulse", "bandage"] },
  { id: "family", label: "Baby & pets", icons: ["baby", "paw-print", "bone", "dog", "cat", "bird"] },
  { id: "other", label: "Other", icons: ["flower", "gift", "party-popper", "shopping-basket", "shopping-bag", "store", "car", "fuel", "tag", "star", "heart"] },
] as const;

export type GroupIcon = (typeof GROUP_ICON_SECTIONS)[number]["icons"][number];

export const GROUP_ICONS: readonly GroupIcon[] = GROUP_ICON_SECTIONS.flatMap((section) => section.icons);

/** True when this build can draw the icon. A false value may still be a valid key from a newer build. */
export const isGroupIcon = (value: string | undefined): value is GroupIcon =>
  value !== undefined && (GROUP_ICONS as readonly string[]).includes(value);
