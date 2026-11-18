const axios = require("axios");
const parseAiResponse = require("../utils/parseAiResponse");

const PRIMARY_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
const CANDIDATE_MODELS = [
    PRIMARY_MODEL,
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b"
].filter((v, i, a) => a.indexOf(v) === i);

async function testGroqConnection() {
    for (const model of CANDIDATE_MODELS) {
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: model,
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
            console.warn(`Groq test connection failed with model ${model}:`, error.response?.data?.error?.message || error.message);
        }
    }
    throw new Error("All Groq models failed connectivity check.");
}

const buildReviewPrompt = (code, language, documentContext = null) => {
    let contextSection = "";
    if (documentContext && Array.isArray(documentContext) && documentContext.length > 0) {
        const formattedChunks = documentContext
            .map(c => `[Page ${c.page_number || '?'}]\n${c.chunk_text}`)
            .join("\n\n---\n\n");

        contextSection = `
PROJECT ARCHITECTURAL GUIDELINES & SPECIFICATIONS:
The following rules and design requirements are extracted from the user's project documentation:
--------------------------------------------------
${formattedChunks}
--------------------------------------------------

ADDITIONAL INSTRUCTIONS FOR COMPLIANCE AUDIT:
- Verify whether each statement complies with or violates the PROJECT ARCHITECTURAL GUIDELINES above.
- If a line violates a guideline, categorize it as "compliance", set "description" explaining the violation, and provide the exact citation in "guideline_citation" (e.g. "[Page 2] ...").
- Include a "compliance_score" (integer 1-10) assessing overall alignment with the document guidelines.
`;
    }

    // Number every line so the model inspects each line with exact coordinate awareness
    const numberedLines = code
        .split("\n")
        .map((l, i) => `${i + 1} | ${l}`)
        .join("\n");

    return `
You are an advanced AI Code Auditor and Precision Static Analysis Engine like Google Antigravity.
Your mandate is to perform an exhaustive, LINE-BY-LINE code audit and review of informal, rough, prototype, or production code written in ${language}.

EXHAUSTIVE LINE-BY-LINE AUDIT OBJECTIVE:
1. Thoroughly inspect EVERY line of code for flaws, missing guards, informal coding habits, security hazards, unhandled edge cases, performance snags, and architectural violations.
2. Even if code is written casually or informally (e.g. missing error handling, loose typing, global leaks, hardcoded values, missing validation, unsafe logs, poor naming, unoptimized loops), identify the exact line and provide the production-grade fix.
3. For each defective or sub-optimal line, provide:
   - "line": The exact 1-based line number.
   - "severity": "critical" (security hole, fatal bug, crash), "warning" (edge-case fail, memory leak, unhandled error, type risk), or "suggestion" (code smell, informal practice, performance boost, readability).
   - "category": "bug" | "security" | "performance" | "style" | "compliance" | "best_practice".
   - "description": Clear, technical explanation of what is wrong or risky with this line.
   - "suggestion": Concrete advice explaining the professional best practice.
   - "original_code": The EXACT line or minimal statement as written in the user's source code.
   - "replacement_code": The EXACT drop-in corrected code ready to replace the flawed line without conversational text.
   - "audit_grade": A short label ("PASSED" | "FLAGGED" | "CRITICAL") for inline glyph reporting.

SURGICAL AUTO-FIX INTEGRITY:
- Fix ONLY the target line/expression.
- Do NOT rewrite or delete other working lines in the file.
- Keep the exact indentation of the original line.
${contextSection}
Return ONLY a valid JSON object strictly adhering to this schema:
{
  "overall_score": <integer from 1 to 10>,
  "compliance_score": <integer from 1 to 10 if guidelines were provided, otherwise null>,
  "summary": "<executive summary of the code audit, highlighting main risks and quality assessment>",
  "issues": [
    {
      "severity": "critical" | "warning" | "suggestion",
      "line": <integer 1-based line number>,
      "category": "bug" | "security" | "performance" | "style" | "compliance" | "best_practice",
      "description": "<technical description of line flaw>",
      "suggestion": "<professional recommendation>",
      "original_code": "<exact line snippet from source to replace>",
      "replacement_code": "<exact drop-in replacement snippet>",
      "guideline_citation": "<specific citation or null>"
    }
  ]
}

Code with line numbers for reference:
${numberedLines}

Raw source code to audit:
\`\`\`${language}
${code}
\`\`\`
`;
};

async function reviewCode(code, language = "unknown", documentContext = null) {
    const prompt = buildReviewPrompt(code, language, documentContext);
    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert static analysis and code review AI. You must always return responses formatted strictly as a valid JSON object."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const aiResponse = response.data.choices[0].message.content;
            const parsedReview = parseAiResponse(aiResponse, code);
            return parsedReview;

        } catch (error) {
            lastError = error.response?.data?.error?.message || error.message;
            console.warn(`Model ${model} review failed (${lastError}), attempting fallback model...`);
        }
    }

    console.error("All candidate Groq models failed review:", lastError);
    return {
        success: false,
        error: lastError || "Failed to generate review across all available AI models"
    };
}

async function streamReviewCode(code, language = "unknown", documentContext = null, onChunk, onComplete, onError) {
    const prompt = buildReviewPrompt(code, language, documentContext);
    let succeeded = false;

    for (const model of CANDIDATE_MODELS) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert static analysis and code review AI. You must always return responses formatted strictly as a valid JSON object."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" },
                    stream: true
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.warn(`Streaming with model ${model} failed HTTP ${response.status}: ${errBody}`);
                continue;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
            let lineBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                lineBuffer += chunk;
                const lines = lineBuffer.split("\n");
                lineBuffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data:")) continue;
                    const dataStr = trimmed.replace(/^data:\s*/, "");
                    if (dataStr === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(dataStr);
                        const token = parsed.choices?.[0]?.delta?.content || "";
                        if (token) {
                            accumulatedText += token;
                            if (onChunk) onChunk(token);
                        }
                    } catch (e) {
                        // skip partial chunk
                    }
                }
            }

            const parsedReview = parseAiResponse(accumulatedText, code);
            if (onComplete) onComplete(parsedReview);
            succeeded = true;
            break;

        } catch (error) {
            console.warn(`streamReviewCode with model ${model} encountered error:`, error.message);
        }
    }

    if (!succeeded) {
        if (onError) onError(new Error("All streaming models exhausted. Falling back to synchronous review."));
    }
}

module.exports = {
    testGroqConnection,
    reviewCode,
    streamReviewCode
};
