const parseAiResponse = require("./src/utils/parseAiResponse");

const test1 = `
\`\`\`json
{
    "overall_score": 8,
    "summary": "Good code",
    "issues": [
        {
            "severity": "warning",
            "line": 4,
            "category": "bug",
            "description": "Missing type check",
            "suggestion": "Add typeof check",
            "replacement_code": "if (typeof price !== 'number') return 0;"
        }
    ]
}
\`\`\`
`;

const test2 = `
Here is my review for your code:
{
    "overall_score": 7,
    "summary": "Average code",
    "issues": []
}
Hope this helps!
`;

console.log("Test 1 Result:", parseAiResponse(test1).success);
console.log("Test 2 Result:", parseAiResponse(test2).success);
