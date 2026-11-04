/** WebSocket path the sync server accepts. A single household store lives here. */
export const SYNC_PATH = "/sync";

/** Subprotocol the server echoes back once the password checks out. */
export const SYNC_PROTOCOL = "mira.v1";

/**
 * Browsers can't set headers on a WebSocket, so the password rides in a second
 * subprotocol entry, base64url-encoded (subprotocol tokens can't contain most
 * punctuation). Same mechanism on native and web.
 */
export const AUTH_PROTOCOL_PREFIX = "mira-auth.";

export const HEALTH_PATH = "/api/health";
export const AUTH_CHECK_PATH = "/api/auth/check";

export type HealthResponse = { app: "mira"; version: string };

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/* Hand-rolled UTF-8 so this runs on Hermes without TextEncoder/TextDecoder. */
const utf8Encode = (text: string): Uint8Array => {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(bytes);
};

const utf8Decode = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const lead = bytes[i] ?? 0;
    const length = lead < 0x80 ? 1 : lead < 0xe0 ? 2 : lead < 0xf0 ? 3 : 4;
    let code = length === 1 ? lead : lead & (0xff >> (length + 1));
    for (let j = 1; j < length; j++) code = (code << 6) | ((bytes[i + j] ?? 0) & 63);
    out += String.fromCodePoint(code);
    i += length;
  }
  return out;
};

export const toBase64Url = (text: string): string => {
  const bytes = utf8Encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const triple = (a << 16) | (b << 8) | c;
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += BASE64_ALPHABET[(triple >> (18 - 6 * j)) & 63];
  }
  return out;
};

export const fromBase64Url = (encoded: string): string | undefined => {
  const values: number[] = [];
  for (const char of encoded) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) return undefined;
    values.push(value);
  }
  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const chunk = values.slice(i, i + 4);
    const bits = chunk.reduce((acc, value, j) => acc | (value << (18 - 6 * j)), 0);
    const byteCount = Math.floor((chunk.length * 6) / 8);
    for (let j = 0; j < byteCount; j++) bytes.push((bits >> (16 - 8 * j)) & 255);
  }
  return utf8Decode(Uint8Array.from(bytes));
};

export const authProtocols = (password: string): string[] => [
  SYNC_PROTOCOL,
  `${AUTH_PROTOCOL_PREFIX}${toBase64Url(password)}`,
];

export const passwordFromProtocols = (protocols: Iterable<string>): string | undefined => {
  for (const protocol of protocols) {
    if (protocol.startsWith(AUTH_PROTOCOL_PREFIX)) {
      return fromBase64Url(protocol.slice(AUTH_PROTOCOL_PREFIX.length));
    }
  }
  return undefined;
};
