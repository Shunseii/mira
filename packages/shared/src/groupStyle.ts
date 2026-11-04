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
 *
 * Each entry lists extra search words, so "bread" finds wheat, croissant and
 * sandwich. Order is the picker order: the design's 35 first, then the rest.
 */
const ICON_ENTRIES = [
  ["carrot", ["vegetables", "veg", "produce"]],
  ["apple", ["fruit", "produce"]],
  ["cherry", ["fruit", "berries"]],
  ["citrus", ["lemon", "lime", "orange", "fruit"]],
  ["leaf", ["greens", "herbs", "vegetables", "tea"]],
  ["wheat", ["bread", "flour", "grain", "bakery", "pasta", "cereal"]],
  ["milk", ["dairy", "drink"]],
  ["egg", ["eggs", "dairy", "breakfast"]],
  ["fish", ["seafood", "sushi"]],
  ["beef", ["meat", "steak", "butcher"]],
  ["drumstick", ["chicken", "poultry", "meat"]],
  ["croissant", ["bread", "pastry", "bakery", "breakfast"]],
  ["cookie", ["biscuit", "snacks", "sweets"]],
  ["coffee", ["tea", "cafe", "drinks"]],
  ["wine", ["alcohol", "drinks"]],
  ["snowflake", ["frozen", "freezer", "ice"]],
  ["spray-can", ["cleaning", "household", "cleaner"]],
  ["sandwich", ["bread", "lunch", "deli"]],
  ["pizza", ["frozen", "takeaway"]],
  ["soup", ["canned", "pantry", "broth"]],
  ["salad", ["greens", "lettuce", "vegetables"]],
  ["banana", ["fruit"]],
  ["grape", ["fruit", "grapes"]],
  ["nut", ["nuts", "snacks", "pantry"]],
  ["cake-slice", ["cake", "dessert", "bakery", "party"]],
  ["candy", ["sweets", "chocolate", "snacks"]],
  ["ice-cream-cone", ["ice cream", "dessert", "frozen"]],
  ["cup-soda", ["soda", "drinks", "juice", "pop"]],
  ["paw-print", ["pets", "pet food", "dog", "cat"]],
  ["beer", ["alcohol", "drinks"]],
  ["popcorn", ["snacks", "movie"]],
  ["bean", ["beans", "legumes", "pantry", "lentils"]],
  ["pill", ["pharmacy", "medicine", "vitamins", "health"]],
  ["baby", ["diapers", "nappies", "kids"]],
  ["sparkles", ["cleaning", "beauty", "toiletries"]],
  ["leafy-green", ["greens", "spinach", "lettuce", "vegetables"]],
  ["sprout", ["herbs", "greens", "vegetables"]],
  ["cake", ["birthday", "dessert", "party"]],
  ["donut", ["sweets", "bakery", "dessert"]],
  ["egg-fried", ["breakfast", "eggs"]],
  ["ice-cream-bowl", ["ice cream", "dessert", "frozen"]],
  ["ham", ["meat", "deli", "cold cuts"]],
  ["shrimp", ["seafood", "prawns"]],
  ["glass-water", ["water", "drinks"]],
  ["droplet", ["water", "oil", "drinks"]],
  ["cooking-pot", ["cooking", "pantry", "pasta", "rice"]],
  ["chef-hat", ["cooking", "spices", "kitchen"]],
  ["utensils", ["kitchen", "cutlery", "takeaway"]],
  ["flame", ["spices", "hot", "bbq", "candles"]],
  ["package", ["pantry", "boxed", "dry goods"]],
  ["candy-cane", ["sweets", "christmas"]],
  ["lollipop", ["sweets", "candy", "kids"]],
  ["popsicle", ["ice lolly", "frozen", "dessert"]],
  ["dessert", ["sweets", "pudding"]],
  ["refrigerator", ["fridge", "chilled", "dairy"]],
  ["thermometer-snowflake", ["frozen", "chilled", "freezer"]],
  ["washing-machine", ["laundry", "detergent"]],
  ["shirt", ["laundry", "clothes"]],
  ["trash", ["bin bags", "garbage", "household"]],
  ["toilet", ["toilet paper", "bathroom"]],
  ["bath", ["bathroom", "soap", "toiletries"]],
  ["shower-head", ["shower", "soap", "shampoo", "toiletries"]],
  ["lightbulb", ["bulbs", "household", "electrical"]],
  ["battery", ["batteries", "electrical"]],
  ["wrench", ["tools", "hardware", "diy"]],
  ["hammer", ["tools", "hardware", "diy"]],
  ["paintbrush", ["paint", "diy", "crafts"]],
  ["scissors", ["crafts", "stationery"]],
  ["house", ["home", "household"]],
  ["tablets", ["pharmacy", "medicine"]],
  ["heart-pulse", ["health", "pharmacy"]],
  ["bandage", ["first aid", "pharmacy"]],
  ["bone", ["dog", "pets", "treats"]],
  ["dog", ["pets", "pet food"]],
  ["cat", ["pets", "pet food", "litter"]],
  ["bird", ["pets", "bird seed"]],
  ["flower", ["flowers", "plants", "garden"]],
  ["gift", ["gifts", "presents", "party"]],
  ["party-popper", ["party", "celebration"]],
  ["shopping-basket", ["groceries", "misc", "other"]],
  ["shopping-bag", ["bags", "shopping"]],
  ["store", ["shop", "market"]],
  ["car", ["car", "auto"]],
  ["fuel", ["gas", "petrol", "car"]],
  ["tag", ["deals", "offers", "misc"]],
  ["star", ["favourites", "special"]],
  ["heart", ["favourites", "love"]],
] as const;

export type GroupIcon = (typeof ICON_ENTRIES)[number][0];

export const GROUP_ICONS: readonly GroupIcon[] = ICON_ENTRIES.map(([key]) => key);

const KEYWORDS = new Map<GroupIcon, readonly string[]>(ICON_ENTRIES.map(([key, words]) => [key, words]));

/** True when this build can draw the icon. A false value may still be a valid key from a newer build. */
export const isGroupIcon = (value: string | undefined): value is GroupIcon =>
  value !== undefined && (GROUP_ICONS as readonly string[]).includes(value);

/** "ice-cream-cone" → "Ice cream cone" */
export const groupIconLabel = (key: string): string => {
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Icons whose name or keywords match the query. Name matches come first, then
 * keyword matches; each word of the query must match something.
 */
export const searchGroupIcons = (query: string): GroupIcon[] => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...GROUP_ICONS];
  const scored: { key: GroupIcon; score: number }[] = [];
  GROUP_ICONS.forEach((key, index) => {
    const name = key.replace(/-/g, " ");
    const words = KEYWORDS.get(key) ?? [];
    let score = 0;
    for (const term of terms) {
      if (name.split(" ").some((part) => part.startsWith(term))) score += 2;
      else if (words.some((word) => word.split(" ").some((part) => part.startsWith(term)))) score += 1;
      else return;
    }
    scored.push({ key, score: score * 1000 - index });
  });
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.key);
};
