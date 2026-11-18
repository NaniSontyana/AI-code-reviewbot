const { query } = require("../config/db");

// Ensure tables exist on boot
async function initReviewHistoryTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS review_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename VARCHAR(255) NOT NULL,
      filepath VARCHAR(512),
      language VARCHAR(50) NOT NULL,
      code TEXT NOT NULL,
      overall_score INTEGER,
      compliance_score INTEGER,
      summary TEXT,
      issues JSONB,
      linter_diagnostics JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_review_history_created_at ON review_history(created_at DESC);
  `;
  try {
    await query(createTableQuery);
    console.log("Review history table verified/created in database.");
  } catch (err) {
    console.warn("Could not create review_history table directly (using mock DB fallback):", err.message);
  }
}

// Save a review snapshot
async function saveReviewSnapshot(data) {
  const {
    filename = "untitled",
    filepath = "untitled",
    language = "javascript",
    code = "",
    overall_score = null,
    compliance_score = null,
    summary = "",
    issues = [],
    linter_diagnostics = []
  } = data;

  const insertQuery = `
    INSERT INTO review_history (
      filename, filepath, language, code, overall_score, compliance_score, summary, issues, linter_diagnostics
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    filename,
    filepath,
    language,
    code,
    overall_score,
    compliance_score,
    summary,
    JSON.stringify(issues),
    JSON.stringify(linter_diagnostics)
  ];

  const result = await query(insertQuery, values);
  return result.rows[0];
}

// Get recent review snapshots
async function getReviewHistory(limit = 30) {
  const selectQuery = `
    SELECT id, filename, filepath, language, overall_score, compliance_score, summary, issues, linter_diagnostics, created_at
    FROM review_history
    ORDER BY created_at DESC
    LIMIT $1;
  `;
  const result = await query(selectQuery, [limit]);
  return result.rows;
}

// Get single review by id
async function getReviewById(id) {
  const selectQuery = `
    SELECT * FROM review_history WHERE id = $1;
  `;
  const result = await query(selectQuery, [id]);
  return result.rows[0] || null;
}

module.exports = {
  initReviewHistoryTable,
  saveReviewSnapshot,
  getReviewHistory,
  getReviewById
};
