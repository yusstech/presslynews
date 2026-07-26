/**
 * Thin client for the Newsroom's own route handlers.
 *
 * There is no bearer token any more: the session is an httpOnly cookie the
 * browser attaches automatically, so this no longer reads or writes
 * localStorage. `NEXT_PUBLIC_API_URL` is gone with it — the routes are part of
 * this app, at a relative path.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    // Same-origin, but explicit: without it a future cross-origin move would
    // silently stop sending the session.
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Uploads bypass `api()` because the body is FormData: setting a JSON
 * Content-Type here would stop the browser writing the multipart boundary.
 */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).message ?? message;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
