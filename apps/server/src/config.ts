import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Config = {
  password: string;
  host: string;
  port: number;
  dataDir: string;
  webDir?: string;
};

const readPassword = (env: NodeJS.ProcessEnv): string => {
  const file = env.MIRA_PASSWORD_FILE;
  const password = file ? readFileSync(file, "utf8").trim() : env.MIRA_PASSWORD;
  if (!password) {
    throw new Error("Set MIRA_PASSWORD (or MIRA_PASSWORD_FILE) to the household password.");
  }
  return password;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => ({
  password: readPassword(env),
  host: env.HOST ?? "0.0.0.0",
  port: Number(env.PORT ?? 8787),
  dataDir: resolve(env.MIRA_DATA_DIR ?? "./data"),
  webDir: env.MIRA_WEB_DIR ? resolve(env.MIRA_WEB_DIR) : undefined,
});
