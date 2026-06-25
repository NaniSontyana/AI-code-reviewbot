const { reviewCode } = require("../services/llm.service");

const handleReview = async (req, res) => {
    try {
        const { code, language } = req.body;

        if (!code || code.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Code is required"
            });
        }

        if (code.length > 10000) {
            return res.status(400).json({
                success: false,
                message: "Code exceeds maximum length"
            });
        }

        const result = await reviewCode(code, language);

        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    handleReview
};