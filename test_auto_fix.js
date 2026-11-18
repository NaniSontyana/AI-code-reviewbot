const fs = require('fs');
const axios = require('./backend/node_modules/axios');

// Load sample file
const samplePath = 'c:/programs/projects/Ai-code review-bot/sample_test.js';
const sourceCode = fs.readFileSync(samplePath, 'utf8');

(async () => {
  try {
    const res = await axios.post('http://localhost:5000/api/review', {
      code: sourceCode,
      language: 'javascript'
    });
    const data = res.data;
    if (!data.success) {
      console.error('Review failed:', data);
      return;
    }
    const issues = data.data?.issues || [];
    console.log('Received', issues.length, 'issues');
    const critical = issues.find(i => i.severity === 'critical');
    if (!critical) {
      console.log('No critical issue found');
      return;
    }
    console.log('Critical issue:', critical);
    const { original_code, replacement_code } = critical;
    if (!original_code || !replacement_code) {
      console.error('Missing original or replacement code');
      return;
    }
    // Simple verbatim replacement (safety: replace only first occurrence)
    const updated = sourceCode.replace(original_code, replacement_code);
    // Verify surrounding lines unchanged
    const srcLines = sourceCode.split(/\r?\n/);
    const updLines = updated.split(/\r?\n/);
    let diffCount = 0;
    for (let i = 0; i < Math.max(srcLines.length, updLines.length); i++) {
      if ((srcLines[i]||'') !== (updLines[i]||'')) diffCount++;
    }
    console.log('Total line changes:', diffCount);
    // Write result to a new file for inspection
    const outPath = 'c:/programs/projects/Ai-code review-bot/sample_test_fixed.js';
    fs.writeFileSync(outPath, updated, 'utf8');
    console.log('Fixed file written to', outPath);
  } catch (err) {
    console.error('Error during test:', err.message);
  }
})();
