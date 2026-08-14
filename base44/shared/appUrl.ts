// Resolves the app's public URL for use in email links.
// Priority: APP_URL secret -> request origin/referer -> default guess.
export function getAppUrl(req?: any): string {
  const envUrl = (process as any).env?.APP_URL;
  if (envUrl) return envUrl;
  try {
    const headers = req?.headers;
    const origin = headers?.get?.("origin");
    if (origin) return origin;
    const referer = headers?.get?.("referer");
    if (referer) {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    // ignore
  }
  return "https://nafkita.base44.app";
}