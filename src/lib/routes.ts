// Base-path-aware routing helpers so the app works at "/" (local server)
// and under a subpath (e.g. GitHub Pages at /privacylens/).

const BASE = import.meta.env.BASE_URL || "/";

/** Build an app-internal href that respects the deploy base path. */
export function appPath(path: string): string {
  return BASE.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

/** Current route with the deploy base path stripped, e.g. "/demo". */
export function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("/")) return hash;

  let path = window.location.pathname;
  if (BASE !== "/" && path.startsWith(BASE.replace(/\/$/, ""))) {
    path = path.slice(BASE.replace(/\/$/, "").length) || "/";
  }
  return path.replace(/\/+$/, "") || "/";
}

/** Public asset URL (samples, downloads) under the deploy base path. */
export function assetUrl(path: string): string {
  return BASE + path.replace(/^\//, "");
}
