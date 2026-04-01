export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = "/api/" + path;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const resp = await fetch(url, { ...options, headers });
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}
