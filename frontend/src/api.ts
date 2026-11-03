export type Character = {
  id: string;
  name: string;
  voice: string;
  appearance: string;
  age: string;
  presentation: string;
  confidence: string;
};
export type Line = {
  id: string;
  text: string;
  character: string;
  emotion: string;
  box: number[];
  assignment: string;
};
export type ComicPage = {
  index: number;
  width: number;
  height: number;
  lines: Line[];
};
export type Book = {
  id: string;
  title: string;
  status: "queued" | "processing" | "ready" | "error";
  progress: number;
  pageCount: number;
  pages: ComicPage[];
  characters: Character[];
  created: number;
  demo: boolean;
  engine?: string;
  notice?: string;
  error?: string;
};
const stored = localStorage.getItem("panel-library-key");
export const token =
  stored && /^[a-f0-9]{64}$/.test(stored)
    ? stored
    : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
localStorage.setItem("panel-library-key", token);
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(BASE + "/api" + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "The server could not complete this request." }));
    throw Error(
      typeof error.detail === "string"
        ? error.detail
        : "Please check the entered values.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function media(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const r = await fetch(BASE + "/api" + path, {
    // Bypass clips cached by earlier versions as well as future voice edits.
    cache: path.includes("/speech/") ? "no-store" : "default",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!r.ok) {
    const e = await r
      .json()
      .catch(() => ({ detail: "Media could not be loaded." }));
    throw Error(e.detail);
  }
  return URL.createObjectURL(await r.blob());
}
export function savedBookmarks(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("panel-bookmarks") || "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
export function progressOf(id: string) {
  const page = Number(localStorage.getItem("panel-progress-" + id) || 0);
  return Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
}
