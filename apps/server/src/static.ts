import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

/**
 * Serves the exported PWA. Unknown paths fall back to index.html so client-side
 * routes load; hashed bundles are cached forever, everything else revalidates.
 */
export const createStaticHandler = (webDir: string) => async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const candidate = normalize(join(webDir, pathname));
  if (!candidate.startsWith(webDir + sep) && candidate !== webDir) {
    response.writeHead(400).end();
    return;
  }

  const tries = [candidate, join(candidate, "index.html"), `${candidate}.html`];
  let file: string | undefined;
  for (const path of tries) {
    if (await isFile(path)) {
      file = path;
      break;
    }
  }
  file ??= join(webDir, "index.html");
  if (!(await isFile(file))) {
    response.writeHead(404, { "content-type": "text/plain" }).end("Web app not built");
    return;
  }

  const immutable = pathname.startsWith("/_expo/static/");
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(response);
};
