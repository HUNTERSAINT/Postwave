import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "https://web-production-be509.up.railway.app";

const TOKEN_KEY = "postwave_token";
let memoryToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function loadToken() {
  try { memoryToken = await SecureStore.getItemAsync(TOKEN_KEY); } catch { memoryToken = null; }
  return memoryToken;
}
export async function saveToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function request<T>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {
    "x-postwave-client": "mobile",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
  if (init.body && typeof init.body === "string" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Something went wrong (${res.status}).`;
    if (res.status === 401 && memoryToken && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T,>(path: string, blob: Blob, contentType: string) => request<T>(path, { method: "POST", body: blob as unknown as BodyInit, headers: { "Content-Type": contentType } }),
};

export type User = { id: string; email: string; name: string; role?: string; timezone?: string };
export type Account = { id: string; platform: string; username?: string | null; displayName?: string | null; isActive: boolean };
export type Target = { accountId: string; platform: string; status: string; errorMessage?: string | null; platformPostUrl?: string | null };
export type Post = { id: string; title?: string | null; content: string; status: string; createdAt: string; publishedAt?: string | null; scheduledAt?: string | null; platforms: Target[] };
export type Media = { id: string; publicUrl: string; contentType: string };
export type Analytics = {
  days: number; providerAvailable: boolean;
  totals: { published: number; views: number; likes: number; comments: number; shares: number; saves: number; reach: number; engagement: number; engagementRate: number };
  platforms: { platform: string; published: number; views: number; engagement: number; likes: number; comments: number }[];
  topPosts: { id: string; content: string; platforms: string[]; views: number; likes: number; comments: number; shares: number; engagement: number }[];
};
export type Plan = { plan: string; [k: string]: unknown };
