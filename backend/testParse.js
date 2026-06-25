const parseAiResponse = require("./src/utils/parseAiResponse");

const sample = `
\`\`\`json
{
    "overall_score": 8,
    "summary": "Good code",
    "issues": []
}
\`\`\`
`;

console.log(parseAiResponse(sample));