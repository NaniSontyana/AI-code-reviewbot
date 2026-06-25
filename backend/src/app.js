const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Route imports for original review bot
const testRoute = require("./routes/test.routes");
const reviewRoute = require("./routes/review.routes");
const reviewLimiter = require("./middleware/rateLimiter");

// Route imports for DocuMind AI
const authRoutes = require("./routes/auth.routes");
const documentRoutes = require("./routes/document.routes");
const chatRoutes = require("./routes/chat.routes");

// Middleware imports
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// DocuMind AI Gateway API Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Legacy AI Code Review Bot Routes (Retained for backward compatibility)
app.use("/api/test", testRoute);
app.use("/api/review", reviewLimiter, reviewRoute);

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "DocuMind AI Gateway & Review Bot",
    timestamp: new Date()
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
