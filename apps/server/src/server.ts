import { mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AUTH_CHECK_PATH,
  HEALTH_PATH,
  SYNC_PATH,
  SYNC_PROTOCOL,
  passwordFromProtocols,
  type HealthResponse,
} from "@mira/shared";
import { createMergeableStore } from "tinybase";
import { createSqliteNodePersister } from "tinybase/persisters/persister-sqlite-node";
import { createWsServer, type WsServer } from "tinybase/synchronizers/synchronizer-ws-server";
import { WebSocketServer } from "ws";
import { createFailureLimiter, createPasswordCheck } from "./auth";
import type { Config } from "./config";
import { createStaticHandler } from "./static";

export const VERSION = "0.1.0";
const MAX_BODY_BYTES = 4096;

export type MiraServer = {
  http: Server;
  sync: WsServer;
  close: () => Promise<void>;
};

const clientAddress = (request: IncomingMessage): string => request.socket.remoteAddress ?? "unknown";

const sendJson = ({ response, status, body }: { response: ServerResponse; status: number; body?: unknown }): void => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(body === undefined ? undefined : JSON.stringify(body));
};

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

const rejectUpgrade = ({ socket, status, reason }: { socket: Duplex; status: number; reason: string }): void => {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
};

export const createMiraServer = ({ config, log = console }: { config: Config; log?: Pick<Console, "info" | "warn" | "error"> }): MiraServer => {
  mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(join(config.dataDir, "mira.db"));
  db.exec("PRAGMA journal_mode = WAL;");

  const checkPassword = createPasswordCheck(config.password);
  const limiter = createFailureLimiter();
  const serveStatic = config.webDir ? createStaticHandler(config.webDir) : undefined;

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has(SYNC_PROTOCOL) ? SYNC_PROTOCOL : false),
  });
  const sync = createWsServer(
    wss,
    (pathId) =>
      pathId === SYNC_PATH.slice(1)
        ? createSqliteNodePersister(createMergeableStore(), db, "mira_household")
        : undefined,
    (error: unknown) => log.warn("[sync] ignored error", error),
  );

  const handleApi = async (request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> => {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    if (pathname === HEALTH_PATH && request.method === "GET") {
      const body: HealthResponse = { app: "mira", version: VERSION };
      sendJson({ response, status: 200, body });
      return;
    }
    if (pathname === AUTH_CHECK_PATH && request.method === "POST") {
      const address = clientAddress(request);
      if (limiter.isBlocked(address)) {
        sendJson({ response, status: 429, body: { error: "too_many_attempts" } });
        return;
      }
      let password: unknown;
      try {
        password = (JSON.parse(await readBody(request)) as { password?: unknown }).password;
      } catch {
        sendJson({ response, status: 400, body: { error: "bad_request" } });
        return;
      }
      if (typeof password === "string" && checkPassword(password)) {
        limiter.reset(address);
        sendJson({ response, status: 204 });
      } else {
        limiter.recordFailure(address);
        sendJson({ response, status: 401, body: { error: "wrong_password" } });
      }
      return;
    }
    sendJson({ response, status: 404, body: { error: "not_found" } });
  };

  const http = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const handle = pathname.startsWith("/api/")
      ? handleApi(request, response, pathname)
      : serveStatic
        ? serveStatic(request, response)
        : Promise.resolve(void sendJson({ response, status: 404, body: { error: "not_found" } }));
    handle.catch((error: unknown) => {
      log.error("[http]", error);
      if (!response.headersSent) sendJson({ response, status: 500, body: { error: "internal" } });
      else response.destroy();
    });
  });

  http.on("upgrade", (request, socket, head) => {
    const address = clientAddress(request);
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== SYNC_PATH) return rejectUpgrade({ socket, status: 404, reason: "Not Found" });
    if (limiter.isBlocked(address)) return rejectUpgrade({ socket, status: 429, reason: "Too Many Requests" });

    const offered = (request.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());
    if (!checkPassword(passwordFromProtocols(offered))) {
      limiter.recordFailure(address);
      return rejectUpgrade({ socket, status: 401, reason: "Unauthorized" });
    }
    limiter.reset(address);
    wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
  });

  const close = async (): Promise<void> => {
    await sync.destroy();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    db.close();
  };

  return { http, sync, close };
};
