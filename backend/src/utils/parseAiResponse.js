function parseAiResponse(rawText) {
    try {

        let cleanedText = rawText.trim();

        if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText
                .replace("```json", "")
                .replace("```", "")
                .trim();
        }

        const parsedData = JSON.parse(cleanedText);

        // Schema Validation
        if (
            typeof parsedData.overall_score !== "number" ||
            typeof parsedData.summary !== "string" ||
            !Array.isArray(parsedData.issues)
        ) {
            throw new Error("Invalid AI response schema");
        }

        return {
            success: true,
            data: parsedData
        };

    } catch (error) {

        return {
            success: false,
            error: error.message || "Invalid AI response format",
            raw: rawText
        };
    }
}

module.exports = parseAiResponse;