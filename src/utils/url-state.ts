// The page's query string as its shareable state, so copying the URL gives
// someone the same drill, lesson or chart selection.

type ParamValue = string | number | string[] | null | undefined;

export function readParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

// Rewrites the query string from `params`; empty values drop the key and lists
// become repeated keys (?position=UTG&position=BTN). `push` adds a history
// entry so the back button returns to the previous view.
export function writeParams(
  params: Record<string, ParamValue>,
  mode: "replace" | "push" = "replace"
) {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  if (mode === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

// Calls `handler` when the browser goes back or forward; returns the cleanup.
export function onUrlChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", handler);
  return () => window.removeEventListener("popstate", handler);
}

export function numberParam(params: URLSearchParams, key: string): number | null {
  const value = params.get(key);
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function numberListParam(params: URLSearchParams, key: string): number[] {
  return params
    .getAll(key)
    .map(Number)
    .filter((number) => Number.isFinite(number));
}
