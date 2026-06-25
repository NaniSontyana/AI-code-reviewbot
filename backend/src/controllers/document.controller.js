const axios = require("axios");
const FormData = require("form-data");
const db = require("../config/db");
require("dotenv").config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const { originalname, buffer } = req.file;
    const userId = req.user.id;

    // 1. Create a pending document record in PostgreSQL
    const docResult = await db.query(
      "INSERT INTO documents (user_id, filename, status) VALUES ($1, $2, 'processing') RETURNING *",
      [userId, originalname]
    );
    const document = docResult.rows[0];

    // 2. Forward the file to the Flask ML microservice asynchronously (do not await)
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: originalname,
      contentType: "application/pdf"
    });
    formData.append("document_id", document.id);

    console.log(`Forwarding document ${document.id} to ML service at ${ML_SERVICE_URL}/ml/process-document...`);
    
    axios.post(`${ML_SERVICE_URL}/ml/process-document`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    .then(response => {
      console.log(`ML service successfully processed document ${document.id}`);
    })
    .catch(async (error) => {
      console.error(`Error in ML service processing for document ${document.id}:`, error.message);
      // Fallback: update status to failed in DB
      try {
        await db.query(
          "UPDATE documents SET status = 'failed' WHERE id = $1",
          [document.id]
        );
      } catch (dbErr) {
        console.error("Failed to update document status to failed in gateway:", dbErr.message);
      }
    });

    // 3. Respond immediately to the client with 'processing' status
    return res.status(202).json({
      success: true,
      message: "Document uploaded and is now processing.",
      document
    });

  } catch (error) {
    console.error("Document upload error in gateway:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during document upload"
    });
  }
};

const listDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      "SELECT id, filename, page_count, chunk_count, status, uploaded_at FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC",
      [userId]
    );

    return res.status(200).json({
      success: true,
      documents: result.rows
    });
  } catch (error) {
    console.error("List documents error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error listing documents"
    });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found or unauthorized"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document and all associated data deleted successfully"
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error deleting document"
    });
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  deleteDocument
};
