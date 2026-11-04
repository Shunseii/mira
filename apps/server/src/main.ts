import { loadConfig } from "./config";
import { createMiraServer, VERSION } from "./server";

const config = loadConfig();
const server = createMiraServer({ config });

server.http.listen(config.port, config.host, () => {
  console.info(`[mira] v${VERSION} listening on ${config.host}:${config.port}`);
  console.info(`[mira] data: ${config.dataDir}${config.webDir ? `, web: ${config.webDir}` : ", web app not served"}`);
});

let shuttingDown = false;
const shutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[mira] ${signal}, saving and shutting down`);
  server
    .close()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("[mira] shutdown failed", error);
      process.exit(1);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
