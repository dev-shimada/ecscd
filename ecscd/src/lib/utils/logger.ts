const isDebug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

export function debugLog(label: string, data: unknown): void {
  if (!isDebug) return;
  const timestamp = new Date().toISOString();
  console.debug(
    `[DEBUG] ${timestamp} ${label}:\n${JSON.stringify(data, null, 2)}`
  );
}
