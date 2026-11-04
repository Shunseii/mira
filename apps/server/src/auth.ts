import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

export const createPasswordCheck = (password: string) => {
  const expected = digest(password);
  return (candidate: string | undefined): boolean =>
    candidate !== undefined && timingSafeEqual(digest(candidate), expected);
};

/**
 * Slows down password guessing: after `maxFailures` wrong guesses within
 * `windowMs`, an address is refused until the window passes.
 */
export const createFailureLimiter = ({
  maxFailures = 10,
  windowMs = 60_000,
  now = Date.now,
}: { maxFailures?: number; windowMs?: number; now?: () => number } = {}) => {
  const failures = new Map<string, number[]>();

  const recent = (address: string): number[] => {
    const cutoff = now() - windowMs;
    const kept = (failures.get(address) ?? []).filter((at) => at > cutoff);
    if (kept.length > 0) failures.set(address, kept);
    else failures.delete(address);
    return kept;
  };

  return {
    isBlocked: (address: string): boolean => recent(address).length >= maxFailures,
    recordFailure: (address: string): void => {
      failures.set(address, [...recent(address), now()]);
    },
    reset: (address: string): void => {
      failures.delete(address);
    },
  };
};

export type FailureLimiter = ReturnType<typeof createFailureLimiter>;
