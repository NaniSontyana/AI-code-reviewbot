const express = require("express");
const router = express.Router();

const {
    testGroqConnection
} = require("../services/llm.service");

router.get("/", async (req, res) => {
    try {
        const result = await testGroqConnection();

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Groq connection failed"
        });
    }
});

module.exports = router;