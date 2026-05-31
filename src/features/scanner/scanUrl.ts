export interface ScanInfo {
  ip: string;
  port: number;
  token: string;
}

export function buildScanUrl(i: ScanInfo): string {
  return `http://${i.ip}:${i.port}/scan?token=${i.token}`;
}
