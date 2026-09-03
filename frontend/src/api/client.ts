const API_BASE = "/api/v1";

let authToken: string | null = localStorage.getItem("token");
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getAuthToken() {
  return authToken;
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    onUnauthorized?.();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = (data && (data.error?.formErrors?.join(", ") || data.error)) || res.statusText;
    throw new ApiError(res.status, typeof message === "string" ? message : "Request failed", data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
