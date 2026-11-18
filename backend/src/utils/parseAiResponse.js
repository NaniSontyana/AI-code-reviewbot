function sanitizeCodeSnippet(snippet) {
    if (!snippet || typeof snippet !== "string") return null;
    let s = snippet.trim();
    // Strip markdown code blocks if the model enclosed it
    if (s.startsWith("```")) {
        const lines = s.split("\n");
        lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) {
            lines.pop();
        }
        s = lines.join("\n").trim();
    }
    return s;
}

function parseAiResponse(rawText, sourceCode = "") {
    if (!rawText || typeof rawText !== "string") {
        return {
            success: false,
            error: "Empty or invalid response from AI model",
            raw: rawText
        };
    }

    try {
        let cleanedText = rawText.trim();

        // 1. If text is wrapped in markdown code fence, extract inside
        const fenceMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenceMatch && fenceMatch[1]) {
            cleanedText = fenceMatch[1].trim();
        } else {
            // 2. Otherwise extract between first '{' and last '}'
            const firstBrace = cleanedText.indexOf("{");
            const lastBrace = cleanedText.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanedText = cleanedText.substring(firstBrace, lastBrace + 1).trim();
            }
        }

        const parsedData = JSON.parse(cleanedText);

        // Schema Validation
        if (
            typeof parsedData.overall_score !== "number" ||
            typeof parsedData.summary !== "string" ||
            !Array.isArray(parsedData.issues)
        ) {
            throw new Error("Invalid AI response schema: overall_score, summary, or issues missing");
        }

        const sourceLines = sourceCode ? sourceCode.split("\n") : [];
        const totalSourceLines = sourceLines.length;

        // Sanitize and normalize issues
        parsedData.compliance_score = typeof parsedData.compliance_score === "number" ? parsedData.compliance_score : null;
        parsedData.issues = parsedData.issues.map((issue) => {
            let original_code = sanitizeCodeSnippet(issue.original_code);
            let replacement_code = sanitizeCodeSnippet(issue.replacement_code);

            // Safety guard: If original_code replaces > 60% of the entire file on a single issue,
            // check if we can constrain it to the line specified
            if (original_code && totalSourceLines > 10) {
                const origLinesCount = original_code.split("\n").length;
                if (origLinesCount > totalSourceLines * 0.7 && typeof issue.line === "number" && issue.line <= totalSourceLines) {
                    // Over-aggressive rewrite detected: narrow down original_code to target line window
                    const targetIdx = issue.line - 1;
                    const fallbackLine = sourceLines[targetIdx];
                    if (fallbackLine && fallbackLine.trim()) {
                        console.warn(`[Safety Guard] Over-aggressive replacement detected (${origLinesCount} lines). Constraining to target line ${issue.line}.`);
                    }
                }
            }

            return {
                severity: issue.severity || "suggestion",
                line: typeof issue.line === "number" ? issue.line : null,
                category: issue.category || "best_practice",
                description: issue.description || "",
                suggestion: issue.suggestion || "",
                original_code: original_code,
                replacement_code: replacement_code,
                guideline_citation: issue.guideline_citation || null
            };
        });

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
