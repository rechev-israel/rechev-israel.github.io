// Minimal structured JSON logger (stdout). Swap for pino/OTel later without changing call sites.
type Level = "debug" | "info" | "warn" | "error";
function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => process.env.NODE_ENV !== "production" && log("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => log("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => log("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => log("error", m, f),
};
