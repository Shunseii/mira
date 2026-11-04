import { AUTH_CHECK_PATH, HEALTH_PATH, SYNC_PATH, type HealthResponse } from "@mira/shared";

const fetchWithTimeout = async ({ url, init, timeoutMs }: { url: string; init?: RequestInit; timeoutMs: number }): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * What the user typed → URLs worth trying, most likely first. "mira.home.arpa"
 * tries https, then plain http, then the default port.
 */
export const candidateServerUrls = (input: string): string[] => {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return [];
  if (/^https?:\/\//i.test(trimmed)) return [trimmed];
  const hasPort = /:\d+$/.test(trimmed);
  return hasPort
    ? [`http://${trimmed}`, `https://${trimmed}`]
    : [`https://${trimmed}`, `http://${trimmed}`, `http://${trimmed}:8787`];
};

export const displayHost = (serverUrl: string | undefined): string =>
  serverUrl ? serverUrl.replace(/^https?:\/\//, "") : "";

export const syncSocketUrl = (serverUrl: string): string => `${serverUrl.replace(/^http/, "ws")}${SYNC_PATH}`;

const isMiraHealth = (body: unknown): body is HealthResponse =>
  typeof body === "object" && body !== null && (body as { app?: unknown }).app === "mira";

/** Returns the first URL that answers as a Mira server, or undefined. */
export const findServer = async (input: string): Promise<string | undefined> => {
  for (const url of candidateServerUrls(input)) {
    try {
      const response = await fetchWithTimeout({ url: `${url}${HEALTH_PATH}`, timeoutMs: 3500 });
      if (response.ok && isMiraHealth(await response.json())) return url;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
};

export type PasswordCheck = "ok" | "wrong" | "rate_limited" | "unreachable";

export const checkPassword = async ({ serverUrl, password }: { serverUrl: string; password: string }): Promise<PasswordCheck> => {
  try {
    const response = await fetchWithTimeout({
      url: `${serverUrl}${AUTH_CHECK_PATH}`,
      init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) },
      timeoutMs: 5000,
    });
    if (response.status === 204) return "ok";
    if (response.status === 401) return "wrong";
    if (response.status === 429) return "rate_limited";
    return "unreachable";
  } catch {
    return "unreachable";
  }
};
