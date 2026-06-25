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
   AI Code Review Bot Endpoint
   ========================================== */
export const reviewCode = async (code, language) => {
  const response = await API.post("/review", {
    code,
    language
  });
  return response.data;
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