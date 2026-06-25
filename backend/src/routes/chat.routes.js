const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { queryDocument, getChatHistory } = require("../controllers/chat.controller");

router.post("/:documentId/query", authenticateToken, queryDocument);
router.get("/:documentId/history", authenticateToken, getChatHistory);

module.exports = router;
