const express = require("express");
const router = express.Router();
const { 
  handleReview, 
  handleStreamReview,
  handleGetHistory,
  handleGetHistoryById 
} = require("../controllers/review.controller");

router.post("/", handleReview);
router.post("/stream", handleStreamReview);
router.get("/history", handleGetHistory);
router.get("/history/:id", handleGetHistoryById);

module.exports = router;
