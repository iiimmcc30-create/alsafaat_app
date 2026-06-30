// Authenticated fetch — attaches Bearer token and retries once after refresh on 401.

type AuthFetchDeps = {
  getToken: () => string | null;
  refresh: () => Promise<boolean>;
};

let deps: AuthFetchDeps | null = null;

export function registerAuthFetch(next: AuthFetchDeps) {
  deps = next;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = deps?.getToken() ?? null;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(input, { ...init, headers });

  if (res.status !== 401 || !deps) return res;

  const refreshed = await deps.refresh();
  if (!refreshed) return res;

  const newToken = deps.getToken();
  if (!newToken) return res;

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
