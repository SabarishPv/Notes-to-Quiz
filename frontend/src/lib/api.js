import { useAuth } from "@clerk/clerk-react";

// Trailing slash on VITE_API_URL would produce "…//api/…" and 404. Strip it.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 30_000;

async function rawRequest(path, { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const isForm = options.body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The server took too long to respond. Please try again.");
    throw new Error("Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

// Public (no-auth) calls — used by the shared-quiz page.
export const publicApi = {
  getSharedQuiz: (token) => rawRequest(`/api/shared/${token}`),
  submitSharedAttempt: (token, answers, guestName) =>
    rawRequest(`/api/shared/${token}/attempts`, {
      method: "POST",
      body: JSON.stringify({ answers, guest_name: guestName || null }),
    }),
};

export function useApi() {
  const { getToken } = useAuth();

  async function request(path, options = {}) {
    const token = await getToken();
    return rawRequest(path, { ...options, token });
  }

  return {
    wakeServer: () => request("/api/health", { timeoutMs: 60_000 }),

    // folders
    listFolders: () => request("/api/folders"),
    createFolder: (name) => request("/api/folders", { method: "POST", body: JSON.stringify({ name }) }),
    renameFolder: (id, name) => request(`/api/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    deleteFolder: (id) => request(`/api/folders/${id}`, { method: "DELETE" }),

    // quizzes
    listQuizzes: ({ folder = "all", sort = "newest" } = {}) =>
      request(`/api/quizzes?folder=${encodeURIComponent(folder)}&sort=${sort}`),
    getQuiz: (id) => request(`/api/quizzes/${id}`),
    generateFromText: ({ text, name, folderId, questionCount, questionTypes }) =>
      request("/api/quizzes", {
        method: "POST",
        body: JSON.stringify({
          text,
          name: name || null,
          folder_id: folderId ?? null,
          question_count: questionCount,
          question_types: questionTypes,
        }),
      }),
    generateFromUpload: ({ file, url, name, folderId, questionCount, questionTypes }) => {
      const body = new FormData();
      if (file) body.append("upload", file);
      if (url) body.append("url", url);
      if (name) body.append("name", name);
      if (folderId != null) body.append("folder_id", String(folderId));
      body.append("question_count", String(questionCount));
      body.append("question_types", questionTypes.join(","));
      return request("/api/quizzes/upload", { method: "POST", body });
    },
    patchQuiz: (id, patch) => request(`/api/quizzes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteQuiz: (id) => request(`/api/quizzes/${id}`, { method: "DELETE" }),
    regenerate: (id) => request(`/api/quizzes/${id}/regenerate`, { method: "POST", body: JSON.stringify({}) }),
    submitAttempt: (id, answers) =>
      request(`/api/quizzes/${id}/attempts`, { method: "POST", body: JSON.stringify({ answers }) }),

    // sharing
    createShareLink: (id) => request(`/api/quizzes/${id}/share`, { method: "POST", body: JSON.stringify({}) }),
    revokeShareLink: (id) => request(`/api/quizzes/${id}/share`, { method: "DELETE" }),
  };
}
