const axios = require("axios");
const db = require("../config/db");
require("dotenv").config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

const queryDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question is required"
      });
    }

    // 1. Verify that the document exists and belongs to this user
    const docCheck = await db.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [documentId, userId]
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found or unauthorized"
      });
    }

    // 2. Insert user's question into chat history
    await db.query(
      "INSERT INTO chat_messages (document_id, user_id, role, content) VALUES ($1, $2, 'user', $3)",
      [documentId, userId, question]
    );

    // 3. Forward query to Flask ML microservice
    console.log(`Forwarding query for doc ${documentId} to ML service...`);
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/ml/query`, {
      question,
      document_id: documentId,
      top_k: 4
    });

    const { answer, citations } = mlResponse.data;

    // 4. Save assistant's answer and citations to chat history
    const assistantMsgResult = await db.query(
      "INSERT INTO chat_messages (document_id, user_id, role, content, citations) VALUES ($1, $2, 'assistant', $3, $4) RETURNING *",
      [documentId, userId, answer, JSON.stringify(citations)]
    );

    const assistantMessage = assistantMsgResult.rows[0];

    return res.status(200).json({
      success: true,
      answer,
      citations,
      message: assistantMessage
    });

  } catch (error) {
    console.error("Query document error:", error.message);
    let errorMsg = "Internal server error during document query";
    
    if (error.response && error.response.data) {
      console.error("ML service error response:", error.response.data);
      errorMsg = error.response.data.message || errorMsg;
    }

    return res.status(500).json({
      success: false,
      message: errorMsg
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    // Verify ownership
    const docCheck = await db.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [documentId, userId]
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found or unauthorized"
      });
    }

    // Retrieve messages
    const result = await db.query(
      "SELECT id, role, content, citations, created_at FROM chat_messages WHERE document_id = $1 AND user_id = $2 ORDER BY created_at ASC",
      [documentId, userId]
    );

    return res.status(200).json({
      success: true,
      history: result.rows
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error retrieving chat history"
    });
  }
};

module.exports = {
  queryDocument,
  getChatHistory
};
