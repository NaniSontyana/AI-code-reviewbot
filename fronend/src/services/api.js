import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});

// Request interceptor to automatically attach JWT token if it exists in localStorage
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration or authentication errors globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear local storage on unauthorized/expired token
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Force reload to redirect to login/update state if necessary
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

/* ==========================================
   AI Code Review Bot Endpoints
   ========================================== */
export const reviewCode = async (code, language, documentId = null, filename = "untitled", filepath = "untitled") => {
  const response = await API.post("/review", {
    code,
    language,
    documentId,
    filename,
    filepath
  });
  return response.data;
};

export const streamReviewCode = async (code, language, documentId = null, onToken, onComplete, onError, onLinter = null, filename = "untitled", filepath = "untitled") => {
  const token = localStorage.getItem("token");
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  
  try {
    const response = await fetch(`${baseUrl}/review/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ code, language, documentId, filename, filepath })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Server error ${response.status}`;
      try {
        const json = JSON.parse(errorText);
        errorMsg = json.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventStr of events) {
        if (!eventStr.trim()) continue;
        const lines = eventStr.split("\n");
        let eventType = "message";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.replace(/^event:\s*/, "").trim();
          } else if (line.startsWith("data:")) {
            dataStr = line.replace(/^data:\s*/, "").trim();
          }
        }

        if (!dataStr) continue;

        try {
          const payload = JSON.parse(dataStr);
          if (eventType === "linter") {
            if (onLinter) onLinter(payload.diagnostics);
          } else if (eventType === "token") {
            if (onToken) onToken(payload.token);
          } else if (eventType === "complete") {
            if (onComplete) onComplete(payload);
          } else if (eventType === "error") {
            if (onError) onError(payload.error || "Streaming failed");
          }
        } catch (e) {
          console.error("Error parsing SSE chunk:", e);
        }
      }
    }
  } catch (err) {
    if (onError) onError(err.message || "Failed to stream code review");
  }
};

/* ==========================================
   User Authentication Endpoints
   ========================================== */
export const loginUser = async (email, password) => {
  const response = await API.post("/auth/login", {
    email,
    password
  });
  if (response.data.success && response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }
  return response.data;
};

export const registerUser = async (username, email, password) => {
  const response = await API.post("/auth/register", {
    username,
    email,
    password
  });
  if (response.data.success && response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

/* ==========================================
   DocuMind AI Document Endpoints
   ========================================== */
export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await API.post("/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return response.data;
};

export const listDocuments = async () => {
  const response = await API.get("/documents");
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await API.delete(`/documents/${id}`);
  return response.data;
};

/* ==========================================
   DocuMind AI Chat Endpoints
   ========================================== */
export const queryDocument = async (documentId, question) => {
  const response = await API.post(`/chat/${documentId}/query`, {
    question
  });
  return response.data;
};

export const getChatHistory = async (documentId) => {
  const response = await API.get(`/chat/${documentId}/history`);
  return response.data;
};

/* ==========================================
   Persistent Review History Endpoints
   ========================================== */
export const getReviewHistory = async (limit = 30) => {
  const response = await API.get(`/review/history?limit=${limit}`);
  return response.data;
};

export const getReviewById = async (id) => {
  const response = await API.get(`/review/history/${id}`);
  return response.data;
};
