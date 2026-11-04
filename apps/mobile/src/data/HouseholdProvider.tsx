import { readUser, type MonthKey, monthKeyOf, type User } from "@mira/shared";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { MergeableStore } from "tinybase";
import { createExternalStore, useExternalStore } from "@/lib/externalStore";
import { startHousehold, type Household, type HouseholdState } from "./household";
import { sessionStore, useSession } from "./session";

const HouseholdContext = createContext<Household | undefined>(undefined);

/**
 * Starts local persistence + sync once a server and password are known, and
 * tears it down if either changes. Each server gets its own local database.
 */
export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { serverUrl, password } = useSession();
  const [household, setHousehold] = useState<Household | undefined>(undefined);

  useEffect(() => {
    if (!serverUrl || !password) return;
    let cancelled = false;
    let started: Household | undefined;
    const stop = (household: Household) =>
      household.stop().catch((error: unknown) => console.warn("[household] stop failed", error));
    void startHousehold({ serverUrl, password, getUserId: () => sessionStore.get().userId }).then((created) => {
      if (cancelled) {
        void stop(created);
        return;
      }
      started = created;
      setHousehold(created);
    });
    return () => {
      cancelled = true;
      setHousehold(undefined);
      if (started) void stop(started);
    };
  }, [serverUrl, password]);

  return <HouseholdContext.Provider value={household}>{children}</HouseholdContext.Provider>;
};

export const useOptionalHousehold = (): Household | undefined => useContext(HouseholdContext);

export const useHousehold = (): Household => {
  const household = useContext(HouseholdContext);
  if (!household) throw new Error("useHousehold before the household started");
  return household;
};

const idleState = createExternalStore<HouseholdState>({ ready: false, status: "connecting", pending: [], hasSynced: false });

export const useHouseholdState = (): HouseholdState => useExternalStore(useOptionalHousehold()?.state ?? idleState);

const useStoreVersion = (store: MergeableStore): number => {
  const [subscribe, getVersion] = useMemo(() => {
    let version = 0;
    return [
      (onChange: () => void) => {
        const id = store.addTablesListener(() => {
          version++;
          onChange();
        });
        return () => {
          store.delListener(id);
        };
      },
      () => version,
    ] as const;
  }, [store]);
  return useSyncExternalStore(subscribe, getVersion, getVersion);
};

/** Recomputes `select` whenever any synced table changes (lists are small). */
export const useStoreQuery = <T,>(select: (store: MergeableStore) => T, deps: DependencyList): T => {
  const { store } = useHousehold();
  const version = useStoreVersion(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => select(store), [store, version, ...deps]);
};

export const useCurrentUser = (): User | undefined => {
  const { userId } = useSession();
  return useStoreQuery((store) => (userId ? readUser({ store, id: userId }) : undefined), [userId]);
};

/** The current calendar month; ticks over if the app stays open past midnight on the 1st. */
export const useCurrentMonth = (): MonthKey => {
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  useEffect(() => {
    const refresh = () => setMonth(monthKeyOf(new Date()));
    const interval = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener("change", (next) => next === "active" && refresh());
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  return month;
};
