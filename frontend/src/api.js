function getApiBaseCandidates() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const candidates = [
    configured,
    `http://${host}:8000`,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function getToken() {
  return localStorage.getItem("lms_token");
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("lms_token", token);
  } else {
    localStorage.removeItem("lms_token");
  }
}

async function request(path, { method = "GET", body, form = false, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload = body;
  if (body && !form) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let lastNetworkError = null;
  const options = { method, headers };
  if (method !== "GET" && method !== "HEAD" && payload !== undefined) {
    options.body = payload;
  }

  for (const base of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, options);

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const data = await res.json();
          if (data && data.detail) {
            detail = Array.isArray(data.detail)
              ? data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
              : typeof data.detail === "object"
              ? JSON.stringify(data.detail)
              : String(data.detail);
          }
        } catch {
          // response wasn't JSON - fall back to statusText
        }
        const error = new Error(detail);
        error.status = res.status;
        throw error;
      }

      if (res.status === 204) return null;
      return res.json();
    } catch (err) {
      const message = err?.message || "";
      if (message === "Failed to fetch" || message.includes("fetch")) {
        lastNetworkError = err;
        continue;
      }
      throw err;
    }
  }

  const fallbackMessage =
    lastNetworkError?.message || "Unable to reach the library API. Please start the backend server.";
  const error = new Error(fallbackMessage);
  error.status = 0;
  throw error;
}

export const api = {
  login: (email, password) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    return request("/auth/login", { method: "POST", body: form, form: true, auth: false });
  },
  signup: (email, password, role) =>
    request("/auth/signup", { method: "POST", body: { email, password, role }, auth: false }),
  me: () => request("/auth/me"),

  listBooks: () => request("/books"),
  searchBooks: (q) => request(`/books/search?q=${encodeURIComponent(q)}`),
  addBook: (title, author, isbn) =>
    request("/books", { method: "POST", body: { title, author, isbn } }),
  removeBook: (bookId) => request(`/books/${bookId}`, { method: "DELETE" }),

  listMembers: () => request("/members"),
  registerMember: (name, email) =>
    request("/members", { method: "POST", body: { name, email } }),
  updateMember: (memberId, name, email) =>
    request(`/members/${memberId}`, { method: "PATCH", body: { name, email } }),
  deleteMember: (memberId) =>
    request(`/members/${memberId}`, { method: "DELETE" }),
  searchMembers: (q) =>
    request(`/members/search?q=${encodeURIComponent(q)}`),

  listLoans: () => request("/loans"),
  createLoan: (bookId, memberId) =>
    request("/loans", { method: "POST", body: { book_id: bookId, member_id: memberId } }),
  returnLoan: (loanId) => request(`/loans/${loanId}/return`, { method: "POST" }),

  listNotifications: () => request("/notifications"),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),

  triggerOverdueReport: () => request("/reports/overdue", { method: "POST" }),
  getOverdueReport: (jobId) => request(`/reports/overdue/${jobId}`),
};
