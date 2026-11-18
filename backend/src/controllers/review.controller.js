const axios = require("axios");
const { reviewCode, streamReviewCode } = require("../services/llm.service");
const { runStaticAnalysis } = require("../services/linter.service");
const { saveReviewSnapshot, getReviewHistory, getReviewById } = require("../services/history.service");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

const fetchDocumentContext = async (documentId, queryText) => {
    if (!documentId) return null;
    try {
        const mlRes = await axios.post(
            `${ML_SERVICE_URL}/ml/retrieve-context`,
            {
                document_id: documentId,
                query: queryText.substring(0, 1000),
                top_k: 4
            },
            { timeout: 7000 }
        );

        if (mlRes.data && mlRes.data.success && Array.isArray(mlRes.data.chunks)) {
            return mlRes.data.chunks;
        }
    } catch (err) {
        console.warn("Could not retrieve document context from ML service:", err.message);
    }
    return null;
};

// Merge static linter diagnostics with LLM review issues cleanly
const mergeIssuesWithLinter = (llmIssues = [], linterDiagnostics = []) => {
    const combined = [...llmIssues];
    linterDiagnostics.forEach(lint => {
        // Avoid duplicate report if LLM reported the same line & category
        const isDuplicate = llmIssues.some(
            issue => issue.line === lint.line && (issue.category === lint.category || issue.description?.includes(lint.rule))
        );
        if (!isDuplicate) {
            combined.push({
                severity: lint.severity,
                line: lint.line,
                category: lint.category,
                description: `[Static Analysis] ${lint.description}`,
                suggestion: lint.suggestion,
                original_code: lint.original_code,
                replacement_code: lint.replacement_code,
                is_static_analysis: true
            });
        }
    });
    // Sort by line number
    return combined.sort((a, b) => (a.line || 9999) - (b.line || 9999));
};

const handleReview = async (req, res) => {
    try {
        const { code, language = "javascript", documentId, filename = "untitled", filepath = "untitled" } = req.body;

        if (!code || code.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Code is required"
            });
        }

        if (code.length > 25000) {
            return res.status(400).json({
                success: false,
                message: "Code exceeds maximum length (25,000 characters)"
            });
        }

        // 1. Run Fast Static Linter AST Analysis
        const linterDiagnostics = runStaticAnalysis(code, language);

        // 2. Fetch ground truth documents if requested
        const documentContext = await fetchDocumentContext(documentId, code);

        // 3. Run LLM Deep Review
        const llmResult = await reviewCode(code, language, documentContext);

        if (llmResult.success && llmResult.data) {
            // Merge issues
            const mergedIssues = mergeIssuesWithLinter(llmResult.data.issues || [], linterDiagnostics);
            llmResult.data.issues = mergedIssues;
            llmResult.data.linter_count = linterDiagnostics.length;

            // Automatically persist to PostgreSQL / Database History
            try {
                const saved = await saveReviewSnapshot({
                    filename,
                    filepath,
                    language,
                    code,
                    overall_score: llmResult.data.overall_score,
                    compliance_score: llmResult.data.compliance_score,
                    summary: llmResult.data.summary,
                    issues: mergedIssues,
                    linter_diagnostics: linterDiagnostics
                });
                llmResult.data.history_id = saved?.id;
            } catch (dbErr) {
                console.warn("Could not persist review to history table:", dbErr.message);
            }
        }

        return res.status(200).json(llmResult);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const handleStreamReview = async (req, res) => {
    try {
        const { code, language = "javascript", documentId, filename = "untitled", filepath = "untitled" } = req.body;

        if (!code || code.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Code is required"
            });
        }

        if (code.length > 25000) {
            return res.status(400).json({
                success: false,
                message: "Code exceeds maximum length (25,000 characters)"
            });
        }

        // Establish Server-Sent Events (SSE) headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        // 1. Run Fast Static Linter AST Analysis immediately
        const linterDiagnostics = runStaticAnalysis(code, language);
        res.write(`event: linter\ndata: ${JSON.stringify({ diagnostics: linterDiagnostics })}\n\n`);

        // 2. Fetch ground truth documents if requested
        const documentContext = await fetchDocumentContext(documentId, code);

        // 3. Stream deep LLM audit
        await streamReviewCode(
            code,
            language,
            documentContext,
            (token) => {
                res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
            },
            async (finalResult) => {
                if (finalResult.success && finalResult.data) {
                    const mergedIssues = mergeIssuesWithLinter(finalResult.data.issues || [], linterDiagnostics);
                    finalResult.data.issues = mergedIssues;
                    finalResult.data.linter_count = linterDiagnostics.length;

                    // Persist to PostgreSQL History
                    try {
                        const saved = await saveReviewSnapshot({
                            filename,
                            filepath,
                            language,
                            code,
                            overall_score: finalResult.data.overall_score,
                            compliance_score: finalResult.data.compliance_score,
                            summary: finalResult.data.summary,
                            issues: mergedIssues,
                            linter_diagnostics: linterDiagnostics
                        });
                        finalResult.data.history_id = saved?.id;
                    } catch (dbErr) {
                        console.warn("Could not persist review to history table:", dbErr.message);
                    }
                }
                res.write(`event: complete\ndata: ${JSON.stringify(finalResult)}\n\n`);
                res.end();
            },
            (error) => {
                console.error("Stream review error:", error);
                res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || "Streaming failed" })}\n\n`);
                res.end();
            }
        );

    } catch (error) {
        console.error("handleStreamReview error:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

const handleGetHistory = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 30;
        const history = await getReviewHistory(limit);
        return res.status(200).json({
            success: true,
            history
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const handleGetHistoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await getReviewById(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Review record not found"
            });
        }
        return res.status(200).json({
            success: true,
            review: item
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    handleReview,
    handleStreamReview,
    handleGetHistory,
    handleGetHistoryById
};
