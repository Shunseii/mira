export type MonthKey = `${number}-${string}`;

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: string): value is MonthKey =>
  MONTH_KEY_PATTERN.test(value);

export const monthKeyOf = (date: Date): MonthKey =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const parseMonthKey = (key: MonthKey): { year: number; month: number } => {
  const match = MONTH_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`Invalid month key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]) };
};

export const addMonths = (key: MonthKey, delta: number): MonthKey => {
  const { year, month } = parseMonthKey(key);
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
};

/** Local-time start of the month, in epoch ms. */
export const monthStart = (key: MonthKey): number => {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month - 1, 1).getTime();
};

export const compareMonthKeys = (a: MonthKey, b: MonthKey): number =>
  a < b ? -1 : a > b ? 1 : 0;

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", options);

const monthLong = formatter({ month: "long" });
const monthShort = formatter({ month: "short" });

export const monthName = (key: MonthKey): string =>
  monthLong.format(monthStart(key));

export const monthShortName = (key: MonthKey): string =>
  monthShort.format(monthStart(key));

export const monthYear = (key: MonthKey): number => parseMonthKey(key).year;
