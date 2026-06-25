const axios = require("axios");
const parseAiResponse = require("../utils/parseAiResponse");

async function testGroqConnection() {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "user",
                        content: "Say hello in one sentence."
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error(error.response?.data || error.message);
        throw error;
    }
}

async function reviewCode(code, language = "unknown") {
    try {
        const prompt = `
You are a senior software engineer performing a code review.

Analyze the following code written in ${language}.

Return ONLY valid JSON.

Use exactly this schema:

{
  "overall_score": <integer 1-10>,
  "summary": "<one sentence overview>",
  "issues": [
    {
      "severity": "critical" | "warning" | "suggestion",
      "line": <integer or null>,
      "category": "bug" | "security" | "performance" | "style" | "best_practice",
      "description": "<what is wrong>",
      "suggestion": "<how to fix it>"
    }
  ]
}

Code to review:

${code}
`;

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const aiResponse =
            response.data.choices[0].message.content;

        const parsedReview =
            parseAiResponse(aiResponse);

        return parsedReview;

    } catch (error) {
        console.error(error.response?.data || error.message);

        return {
            success: false,
            error: "Failed to generate review"
        };
    }
}

module.exports = {
    testGroqConnection,
    reviewCode
};