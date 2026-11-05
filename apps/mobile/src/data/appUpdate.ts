import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useState } from "react";
import { useOptionalHousehold } from "./HouseholdProvider";

export type UpdateStatus = "idle" | "checking" | "downloading" | "failed" | "ready";

/**
 * The development build (APP_VARIANT=development, see app.config.ts) loads its JS from
 * a dev server; expo-updates is switched on there too but can't check or fetch.
 */
const IS_DEVELOPMENT_BUILD = Application.applicationId?.endsWith(".dev") ?? false;

/** The git commit an update was published from, stamped in by `pnpm ota "<message>"` (root package.json); "-dirty" if it had uncommitted changes. */
const UPDATE_COMMIT = process.env.EXPO_PUBLIC_OTA_COMMIT;

const shortDate = (date: Date): string => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const shortTime = (date: Date): string => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * Over-the-air updates. expo-updates checks on every launch and downloads in the
 * background; this adds a manual check and a restart that saves the household first.
 * In the development build `enabled` is false and nothing can be checked.
 */
export const useAppUpdate = () => {
  const updates = Updates.useUpdates();
  const household = useOptionalHousehold();
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const enabled = Updates.isEnabled && !IS_DEVELOPMENT_BUILD;
  const ready = enabled && updates.isUpdatePending;

  const status: UpdateStatus = ready
    ? "ready"
    : updates.isDownloading
      ? "downloading"
      : checking || updates.isChecking
        ? "checking"
        : checkFailed
          ? "failed"
          : "idle";

  const check = async () => {
    if (!enabled || checking) return;
    setChecking(true);
    setCheckFailed(false);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch (error) {
      // Usually offline or the update server is unreachable; the row says so quietly.
      console.warn("[updates] check failed", error);
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  };

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    try {
      // Saves the household and closes its database, so the reload can't land mid-write.
      await household?.stop();
    } catch (error) {
      console.warn("[updates] saving before restart failed", error);
    }
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn("[updates] restart failed", error);
      setRestarting(false);
    }
  };

  const { createdAt, isEmbeddedLaunch } = updates.currentlyRunning;
  const nativeVersion = Application.nativeApplicationVersion ?? "?";
  const commit = isEmbeddedLaunch ? undefined : UPDATE_COMMIT;
  const version = [nativeVersion, commit, createdAt && shortDate(createdAt)].filter(Boolean).join(" · ");
  const lastChecked = updates.lastCheckForUpdateTimeSinceRestart;

  return {
    enabled,
    ready,
    status,
    restarting,
    version,
    lastCheckedLabel: lastChecked ? `Checked ${shortTime(lastChecked)}` : undefined,
    check,
    restart,
  };
};
