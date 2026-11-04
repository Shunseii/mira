import { deviceStorage } from "@/lib/deviceStorage";
import { createExternalStore, useExternalStore } from "@/lib/externalStore";

/**
 * Who this device is: which server, the household password, and the chosen
 * profile. Cached so the app opens straight to the list (Koffan made you log
 * in every time).
 */
export type Session = {
  serverUrl?: string;
  password?: string;
  userId?: string;
};

const KEYS = { serverUrl: "mira.serverUrl", password: "mira.password", userId: "mira.userId" } as const;

const load = (): Session => ({
  serverUrl: deviceStorage.get(KEYS.serverUrl) ?? undefined,
  password: deviceStorage.get(KEYS.password) ?? undefined,
  userId: deviceStorage.get(KEYS.userId) ?? undefined,
});

export const sessionStore = createExternalStore<Session>(load());

export const useSession = (): Session => useExternalStore(sessionStore);

export const updateSession = (patch: { [K in keyof Session]?: string | null }): void => {
  for (const [key, value] of Object.entries(patch) as [keyof Session, string | null | undefined][]) {
    if (value === undefined) continue;
    if (value === null) deviceStorage.remove(KEYS[key]);
    else deviceStorage.set(KEYS[key], value);
  }
  sessionStore.set(load());
};

export type LoginStep = "server" | "password" | "who" | "done";

export const loginStep = (session: Session): LoginStep =>
  !session.serverUrl ? "server" : !session.password ? "password" : !session.userId ? "who" : "done";
