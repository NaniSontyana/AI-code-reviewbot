const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const { uploadDocument, listDocuments, deleteDocument } = require("../controllers/document.controller");

// Multer memory storage configuration (keeps file in buffer for proxying)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  }
});

router.post("/upload", authenticateToken, upload.single("file"), uploadDocument);
router.get("/", authenticateToken, listDocuments);
router.delete("/:id", authenticateToken, deleteDocument);

module.exports = router;
