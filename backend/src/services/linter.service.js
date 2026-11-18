/**
 * Fast AST-based & Heuristic Static Analysis Linter Pipeline
 * Pre-filters code before or alongside LLM review to catch syntax errors,
 * security vulnerabilities, performance bottlenecks, and bad practices.
 */

// Simple lightweight syntax & AST checker for JavaScript/Node
function checkJavaScriptSyntax(code) {
  const diagnostics = [];
  try {
    // Test parsing with Function constructor without executing
    new Function(code);
  } catch (err) {
    // Extract line number if present
    const match = err.stack?.match(/<anonymous>:(\d+):(\d+)/);
    const line = match ? parseInt(match[1], 10) - 2 : 1; // offset adjustment
    diagnostics.push({
      line: Math.max(1, line),
      severity: "critical",
      category: "bug",
      rule: "syntax-error",
      description: `JavaScript Syntax Error: ${err.message}`,
      suggestion: "Check syntax, missing brackets, or unclosed string literals."
    });
  }
  return diagnostics;
}

// Regex and Pattern-based rules (Semgrep / Bandit inspired rules)
const STATIC_RULES = [
  // 1. Security: Hardcoded Credentials / Secrets
  {
    regex: /(?:password|secret|apikey|api_key|token|private_key)\s*[:=]\s*["']([A-Za-z0-9_\-]{8,})["']/i,
    severity: "critical",
    category: "security",
    rule: "hardcoded-secret",
    description: "Hardcoded secret or credential detected in source code.",
    suggestion: "Extract sensitive credentials into environment variables (e.g., process.env.SECRET) and use .env files."
  },
  // 2. Security: SQL Injection / Raw string concatenation in queries
  {
    regex: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\+\s*[\w.]+/i,
    severity: "critical",
    category: "security",
    rule: "sql-injection-risk",
    description: "Potential SQL injection vulnerability via raw string concatenation in SQL queries.",
    suggestion: "Use parameterized queries ($1, $2) or an ORM/query builder instead of string concatenation."
  },
  // 3. Security: eval() execution
  {
    regex: /\beval\s*\(/,
    severity: "critical",
    category: "security",
    rule: "no-eval",
    description: "Use of eval() detected, allowing arbitrary remote code execution.",
    suggestion: "Refactor to use JSON.parse() or a safe parser alternative instead of eval()."
  },
  // 4. Best Practice: console.log in production code
  {
    regex: /\bconsole\.log\s*\(/,
    severity: "suggestion",
    category: "best_practice",
    rule: "no-console-log",
    description: "Direct console.log() statement found in code.",
    suggestion: "Use a structured logging library (e.g. Winston, Pino) or remove before deploying to production."
  },
  // 5. Bug / Performance: Synchronous fs methods
  {
    regex: /\bfs\.(?:readFileSync|writeFileSync|existsSync)\b/,
    severity: "warning",
    category: "performance",
    rule: "no-sync-fs",
    description: "Synchronous file system method detected, which blocks the Node.js event loop.",
    suggestion: "Use asynchronous fs.promises methods (fs.promises.readFile) with async/await."
  },
  // 6. Security: Weak cryptographic algorithms (MD5, SHA1)
  {
    regex: /crypto\.createHash\(\s*['"](md5|sha1)['"]\s*\)/i,
    severity: "warning",
    category: "security",
    rule: "weak-crypto-hash",
    description: "Weak cryptographic hashing algorithm (MD5/SHA1) detected.",
    suggestion: "Upgrade to SHA-256 (crypto.createHash('sha256')) or bcrypt/argon2 for password hashing."
  },
  // 7. Security: InnerHTML / Unsafe DOM insertion
  {
    regex: /\.innerHTML\s*=/,
    severity: "warning",
    category: "security",
    rule: "xss-inner-html",
    description: "Direct assignment to innerHTML detected, leading to potential Cross-Site Scripting (XSS).",
    suggestion: "Use textContent, innerText, or sanitize HTML with DOMPurify before assigning to innerHTML."
  },
  // 8. Quality: == vs ===
  {
    regex: /[^=!<>]==[^=]/,
    severity: "suggestion",
    category: "style",
    rule: "strict-equality",
    description: "Loose equality operator (==) used instead of strict equality (===).",
    suggestion: "Use strict equality (===) to prevent unexpected type coercion."
  }
];

// Run fast multi-language static analysis
function runStaticAnalysis(code, language = "javascript") {
  const diagnostics = [];
  const lines = code.split("\n");

  // Run syntax parse check for JavaScript
  if (language === "javascript" || language === "js" || language === "jsx") {
    const syntaxErrors = checkJavaScriptSyntax(code);
    diagnostics.push(...syntaxErrors);
  }

  // Run static pattern checks line-by-line
  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return;

    for (const rule of STATIC_RULES) {
      if (rule.regex.test(lineText)) {
        diagnostics.push({
          line: lineNum,
          severity: rule.severity,
          category: rule.category,
          rule: rule.rule,
          description: rule.description,
          suggestion: rule.suggestion,
          original_code: lineText.trim(),
          replacement_code: null
        });
      }
    }
  });

  return diagnostics;
}

module.exports = {
  runStaticAnalysis
};
