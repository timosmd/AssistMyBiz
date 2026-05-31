export const MAX_LOG = 100;

let buffer: string[] = [];

export function pushLog(line: string): void {
  buffer.push(line);
  if (buffer.length > MAX_LOG) buffer.splice(0, buffer.length - MAX_LOG);
}

export function getLog(): string[] {
  return [...buffer];
}

export function clearLog(): void {
  buffer = [];
}

export function logEvent(msg: string): void {
  pushLog(`${new Date().toISOString()} ${msg}`);
}

let patched = false;

/** Leitet console.error/warn zusätzlich in den Ringpuffer. Idempotent. */
export function installConsoleCapture(): void {
  if (patched) return;
  patched = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    pushLog(`ERROR ${args.map(String).join(" ")}`);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushLog(`WARN ${args.map(String).join(" ")}`);
    origWarn(...args);
  };
}
