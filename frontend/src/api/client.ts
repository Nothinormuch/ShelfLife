const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = localStorage.getItem('shelflife_access_token');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(url, { ...options, headers });

  // Silent token refresh on 401 token_expired
  if (response.status === 401) {
    const errorClone = response.clone();
    try {
      const errData = await errorClone.json();
      if (errData.error === 'token_expired') {
        const refreshToken = localStorage.getItem('shelflife_refresh_token');
        if (refreshToken) {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const tokenData = await refreshRes.json();
            localStorage.setItem('shelflife_access_token', tokenData.accessToken);
            localStorage.setItem('shelflife_refresh_token', tokenData.refreshToken);

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${tokenData.accessToken}`);
            response = await fetch(url, { ...options, headers });
          } else {
            // Refresh failed, clear tokens
            localStorage.removeItem('shelflife_access_token');
            localStorage.removeItem('shelflife_refresh_token');
            localStorage.removeItem('shelflife_user');
            window.location.href = '/login';
          }
        }
      }
    } catch (e) {
      // ignore JSON parse error on non-json 401
    }
  }

  return response;
}
