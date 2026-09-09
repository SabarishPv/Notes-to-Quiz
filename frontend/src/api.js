import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;

export function useApi() {
  const { getToken } = useAuth();

  async function request(path, options = {}) {
    const token = await getToken();
    const isForm = options.body instanceof FormData;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isForm ? {} : { "Content-Type": "application/json" }),
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("The server took too long to respond. Please try again.");
      }
      throw new Error("Could not reach the server. Check your connection and try again.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || `Request failed (${response.status})`);
    }

    return response.json();
  }

  return {
    generateSet: (text, name) =>
      request("/api/generate", {
        method: "POST",
        body: JSON.stringify({ text, name }),
      }),
    generateUpload: ({ file, url, name }) => {
      const body = new FormData();
      if (file) body.append("upload", file);
      if (url) body.append("url", url);
      if (name) body.append("name", name);
      return request("/api/generate-upload", { method: "POST", body });
    },
    fetchHistory: (sort = "newest") => request(`/api/history?sort=${sort}`),
    saveResult: (id, answers) =>
      request(`/api/tests/${id}/result`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
    regenerate: (id) =>
      request(`/api/tests/${id}/regenerate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    wakeServer: () => request("/api/health", { timeoutMs: 60_000 }),
  };
}