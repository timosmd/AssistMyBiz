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
  const target = console as Console & Record<string, unknown>;
  const proxyHandler: ProxyHandler<typeof target> = {
    get(obj, prop: string | symbol) {
      const val = Reflect.get(obj, prop);
      if (prop === "error") {
        return (...args: unknown[]) => {
          pushLog(`ERROR ${args.map(String).join(" ")}`);
          if (typeof val === "function") (val as (...a: unknown[]) => void).apply(obj, args);
        };
      }
      if (prop === "warn") {
        return (...args: unknown[]) => {
          pushLog(`WARN ${args.map(String).join(" ")}`);
          if (typeof val === "function") (val as (...a: unknown[]) => void).apply(obj, args);
        };
      }
      if (typeof val === "function") return val.bind(obj);
      return val;
    },
  };
  globalThis.console = new Proxy(target, proxyHandler);
}
