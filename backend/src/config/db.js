const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Shared mock database path in the workspace root
const MOCK_DB_PATH = path.join(__dirname, "../../../mock_db.json");

// Helper to initialize the mock database file if it doesn't exist
const initMockDb = () => {
  if (!fs.existsSync(MOCK_DB_PATH)) {
    const initialData = {
      users: [],
      documents: [],
      document_chunks: [],
      chat_messages: []
    };
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
  }
};

// Helper to read mock DB
const readMockDb = () => {
  initMockDb();
  try {
    const content = fs.readFileSync(MOCK_DB_PATH, "utf8");
    return JSON.parse(content);
  } catch (e) {
    console.error("Error reading mock DB:", e);
    return { users: [], documents: [], document_chunks: [], chat_messages: [] };
  }
};

// Helper to write mock DB
const writeMockDb = (data) => {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error writing mock DB:", e);
  }
};

let useMock = false;

// Mock Query Processor - Emulates the specific PostgreSQL queries used in the gateway
const runMockQuery = (text, params = []) => {
  const db = readMockDb();
  const cleanedText = text.replace(/\s+/g, " ").trim();

  // 1. Check if user exists (Registration/Login check)
  // SELECT id FROM users WHERE email = $1 OR username = $2
  if (cleanedText.includes("SELECT id FROM users WHERE email =") || 
      (cleanedText.includes("SELECT") && cleanedText.includes("FROM users WHERE email =") && cleanedText.includes("OR username ="))) {
    const email = params[0];
    const username = params[1];
    const found = db.users.filter(u => u.email === email || u.username === username);
    return { rows: found.map(u => ({ id: u.id })) };
  }

  // 2. Insert User (Registration)
  // INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at
  if (cleanedText.includes("INSERT INTO users")) {
    const newUser = {
      id: crypto.randomUUID(),
      username: params[0],
      email: params[1],
      password_hash: params[2],
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    writeMockDb(db);
    
    // Return user without password_hash
    const { password_hash, ...userResponse } = newUser;
    return { rows: [userResponse] };
  }

  // 3. Find User by Email (Login check)
  // SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1
  if (cleanedText.includes("FROM users WHERE email =")) {
    const email = params[0];
    const found = db.users.filter(u => u.email === email);
    return { rows: found };
  }

  // 4. Insert Document (Upload starts)
  // INSERT INTO documents (user_id, filename, status) VALUES ($1, $2, 'processing') RETURNING *
  if (cleanedText.includes("INSERT INTO documents")) {
    const newDoc = {
      id: crypto.randomUUID(),
      user_id: params[0],
      filename: params[1],
      page_count: null,
      chunk_count: null,
      status: "processing",
      uploaded_at: new Date().toISOString()
    };
    db.documents.push(newDoc);
    writeMockDb(db);
    return { rows: [newDoc] };
  }

  // 5. List Documents
  // SELECT id, filename, page_count, chunk_count, status, uploaded_at FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC
  if (cleanedText.includes("FROM documents WHERE user_id =")) {
    const userId = params[0];
    const docs = db.documents
      .filter(d => d.user_id === userId)
      .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    return { rows: docs };
  }

  // 6. Delete Document
  // DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *
  if (cleanedText.includes("DELETE FROM documents")) {
    const docId = params[0];
    const userId = params[1];
    const docIndex = db.documents.findIndex(d => d.id === docId && d.user_id === userId);
    
    if (docIndex === -1) {
      return { rows: [] };
    }
    
    const [deletedDoc] = db.documents.splice(docIndex, 1);
    // Also clean up associated chunks and chat messages
    db.document_chunks = db.document_chunks.filter(c => c.document_id !== docId);
    db.chat_messages = db.chat_messages.filter(m => m.document_id !== docId);
    
    writeMockDb(db);
    return { rows: [deletedDoc] };
  }

  // 7. Update Document Status (Failed fallback in gateway)
  // UPDATE documents SET status = 'failed' WHERE id = $1
  if (cleanedText.includes("UPDATE documents SET status = 'failed'")) {
    const docId = params[0];
    const doc = db.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = "failed";
      writeMockDb(db);
    }
    return { rows: [] };
  }

  // 8. Insert Chat Message
  // INSERT INTO chat_messages (document_id, user_id, role, content) ...
  // INSERT INTO chat_messages (document_id, user_id, role, content, citations) VALUES ($1, $2, 'assistant', $3, $4) RETURNING *
  if (cleanedText.includes("INSERT INTO chat_messages")) {
    let role = "user";
    let content = "";
    let citations = null;

    if (cleanedText.includes("'assistant'")) {
      role = "assistant";
      // Support both original (5-params) and corrected (4-params) parameter lists
      if (params.length === 5) {
        content = params[3];
        citations = params[4] ? JSON.parse(params[4]) : null;
      } else {
        content = params[2];
        citations = params[3] ? JSON.parse(params[3]) : null;
      }
    } else {
      role = "user";
      content = params[2];
    }

    const newMsg = {
      id: crypto.randomUUID(),
      document_id: params[0],
      user_id: params[1],
      role: role,
      content: content,
      citations: citations,
      created_at: new Date().toISOString()
    };
    db.chat_messages.push(newMsg);
    writeMockDb(db);
    return { rows: [newMsg] };
  }

  // 9. Get Chat History
  // SELECT id, role, content, citations, created_at FROM chat_messages WHERE document_id = $1 AND user_id = $2 ORDER BY created_at ASC
  if (cleanedText.includes("FROM chat_messages WHERE document_id =")) {
    const docId = params[0];
    const userId = params[1];
    const history = db.chat_messages
      .filter(m => m.document_id === docId && m.user_id === userId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { rows: history };
  }

  // 10. Verify Document Ownership / Existence
  // SELECT id FROM documents WHERE id = $1 AND user_id = $2
  if (cleanedText.includes("SELECT id FROM documents WHERE id =") && cleanedText.includes("AND user_id =")) {
    const docId = params[0];
    const userId = params[1];
    const found = db.documents.filter(d => d.id === docId && d.user_id === userId);
    return { rows: found.map(d => ({ id: d.id })) };
  }

  // Generic fallback
  return { rows: [] };
};

const query = async (text, params) => {
  if (useMock) {
    return runMockQuery(text, params);
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Detect connection failures
    const isConnError = !connectionString ||
                        err.code === "ECONNREFUSED" ||
                        err.code === "ENOTFOUND" ||
                        err.code === "ETIMEDOUT" ||
                        err.code === "EADDRNOTAVAIL" ||
                        (err.message && (
                          err.message.toLowerCase().includes("connect") || 
                          err.message.toLowerCase().includes("connection") || 
                          err.message.toLowerCase().includes("timeout") || 
                          err.message.toLowerCase().includes("refused") ||
                          err.message.toLowerCase().includes("database_url")
                        ));
                        
    if (isConnError) {
      console.warn("\n=====================================================================");
      console.warn("WARNING: Database connection failed. Falling back to local Mock Database Mode.");
      console.warn(`Local JSON store initialized at: ${MOCK_DB_PATH}`);
      console.warn("=====================================================================\n");
      useMock = true;
      return runMockQuery(text, params);
    }
    throw err;
  }
};

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.warn("PostgreSQL connection refused. Gateway will dynamically fall back to local mock database (mock_db.json) during operations.");
  } else {
    console.log("Database connected successfully at:", res.rows[0].now);
  }
});

module.exports = {
  query,
  pool
};
