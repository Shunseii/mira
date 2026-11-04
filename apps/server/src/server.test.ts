import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addItem, authProtocols, liveItemsOf, SYNC_PATH } from "@mira/shared";
import { createMergeableStore, type MergeableStore } from "tinybase";
import { createWsSynchronizer, type WsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createFailureLimiter } from "./auth";
import { createMiraServer, type MiraServer } from "./server";

const PASSWORD = "open sesame";
const silent = { info: () => {}, warn: () => {}, error: () => {} };

let dataDir: string;
let running: MiraServer | undefined;
const synchronizers: WsSynchronizer<WebSocket>[] = [];

const start = async (): Promise<string> => {
  running = createMiraServer({ config: { password: PASSWORD, host: "127.0.0.1", port: 0, dataDir }, log: silent });
  await new Promise<void>((resolve) => running!.http.listen(0, "127.0.0.1", resolve));
  return `127.0.0.1:${(running.http.address() as AddressInfo).port}`;
};

const stop = async (): Promise<void> => {
  for (const synchronizer of synchronizers.splice(0)) await synchronizer.destroy();
  await running?.close();
  running = undefined;
};

const connect = async ({ host, password }: { host: string; password: string }): Promise<MergeableStore> => {
  const store = createMergeableStore();
  const socket = new WebSocket(`ws://${host}${SYNC_PATH}`, authProtocols(password));
  const synchronizer = await createWsSynchronizer(store, socket, 1);
  synchronizers.push(synchronizer);
  await synchronizer.startSync();
  return store;
};

const waitFor = async (condition: () => boolean, timeoutMs = 3000): Promise<void> => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "mira-test-"));
});

afterEach(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("sync server", () => {
  it("answers health and checks the password over HTTP", async () => {
    const host = await start();
    expect(await (await fetch(`http://${host}/api/health`)).json()).toMatchObject({ app: "mira" });
    const check = (password: string) =>
      fetch(`http://${host}/api/auth/check`, { method: "POST", body: JSON.stringify({ password }) });
    expect((await check("nope")).status).toBe(401);
    expect((await check(PASSWORD)).status).toBe(204);
  });

  it("refuses a WebSocket with the wrong password", async () => {
    const host = await start();
    const status = await new Promise<number | undefined>((resolve) => {
      const socket = new WebSocket(`ws://${host}${SYNC_PATH}`, authProtocols("wrong"));
      socket.on("unexpected-response", (_request, response) => resolve(response.statusCode));
      socket.on("open", () => resolve(101));
      socket.on("error", () => {});
    });
    expect(status).toBe(401);
  });

  it("syncs between clients and keeps data across restarts", async () => {
    let host = await start();
    const phoneA = await connect({ host, password: PASSWORD });
    const phoneB = await connect({ host, password: PASSWORD });
    addItem({ store: phoneA, month: "2026-11", userId: "u1", item: { name: "Tomatoes", qty: "1", unit: "kg" } });
    await waitFor(() => liveItemsOf({ store: phoneB, month: "2026-11" }).length === 1);

    await stop();
    host = await start();
    const phoneC = await connect({ host, password: PASSWORD });
    await waitFor(() => liveItemsOf({ store: phoneC, month: "2026-11" }).length === 1);
    expect(liveItemsOf({ store: phoneC, month: "2026-11" })[0]?.name).toBe("Tomatoes");
  });
});

describe("failure limiter", () => {
  it("blocks after too many failures and forgets after the window", () => {
    let now = 0;
    const limiter = createFailureLimiter({ maxFailures: 2, windowMs: 1000, now: () => now });
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(true);
    now = 1500;
    expect(limiter.isBlocked("a")).toBe(false);
  });
});
