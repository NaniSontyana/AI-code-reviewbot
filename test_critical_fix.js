const fs = require('fs');
const path = require('path');
const axios = require('./backend/node_modules/axios');

// Load diffPatcher logic (reused from frontend utils)
function applyMultiLineFix(sourceCode, issue) {
  if (!sourceCode) return { success: false, newCode: sourceCode };
  const { line, replacement_code, suggestion, original_code } = issue;
  let newSnippet = replacement_code || suggestion || '';
  if (newSnippet.startsWith('```')) {
    const lines = newSnippet.split('\n');
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    newSnippet = lines.join('\n');
  }
  newSnippet = newSnippet.replace(/\r\n/g, '\n').trimEnd();
  if (!newSnippet) return { success: false, newCode: sourceCode };
  const normalizedSource = sourceCode.replace(/\r\n/g, '\n');
  const sourceLines = normalizedSource.split('\n');
  const isOverlyBroad = original_code && original_code.split('\n').length > 15 && original_code.split('\n').length > sourceLines.length * 0.6;
  if (original_code && original_code.trim() && !isOverlyBroad) {
    const rawOriginal = original_code.replace(/\r\n/g, '\n');
    if (normalizedSource.includes(rawOriginal)) {
      const firstLineIndent = (rawOriginal.match(/^[ \t]*/) || [''])[0];
      let adjustedSnippet = newSnippet;
      if (firstLineIndent && !newSnippet.startsWith(firstLineIndent)) {
        adjustedSnippet = newSnippet
          .split('\n')
          .map((ln, idx) => (idx === 0 || ln.trim() === '' ? ln : firstLineIndent + ln.trimStart()))
          .join('\n');
      }
      const updatedCode = normalizedSource.replace(rawOriginal, adjustedSnippet);
      return { success: true, newCode: updatedCode, method: 'verbatim_match' };
    }
  }
  if (typeof line === 'number' && line >= 1 && line <= sourceLines.length) {
    const targetIdx = line - 1;
    const targetLineText = sourceLines[targetIdx];
    const targetIndent = (targetLineText.match(/^[ \t]*/) || [''])[0];
    let linesSpan = 1;
    if (original_code && !isOverlyBroad) {
      const origLines = original_code.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
      if (origLines.length > 1) {
        linesSpan = Math.min(origLines.length, 8);
      }
    }
    const snippetLines = newSnippet.split('\n');
    const properlyIndentedSnippetLines = snippetLines.map(sLine => {
      if (sLine.trim() === '') return '';
      if (sLine.startsWith(targetIndent)) return sLine;
      return targetIndent + sLine.trimStart();
    });
    const newLines = [...sourceLines];
    newLines.splice(targetIdx, linesSpan, ...properlyIndentedSnippetLines);
    return { success: true, newCode: newLines.join('\n'), method: 'boundary_splice' };
  }
  return { success: false, newCode: sourceCode };
}

(async () => {
  try {
    const samplePath = path.resolve('sample_test.js');
    const source = fs.readFileSync(samplePath, 'utf8');
    // Mocked issue instead of API call
    const mockIssue = {
      line: 1,
      severity: 'critical',
      original_code: "const x = eval(userInput);",
      replacement_code: "const x = Function(userInput);"
    };
    console.log('Using mocked issue');
    const critical = mockIssue;
      code: source,
      language: 'javascript'
    });
    const data = resp.data;
    if (!data.success) {
      console.error('Review API error', data);
      return;
    }
    const issues = (data.data && data.data.issues) || [];
    const critical = issues.find(i => i.severity === 'critical');
    if (!critical) {
      console.log('No critical issues found');
      return;
    }
    console.log('Critical issue:', critical);
    const result = applyMultiLineFix(source, critical);
    console.log('Patch result method:', result.method, 'success:', result.success);
    const outPath = path.resolve('sample_test_fixed.js');
    fs.writeFileSync(outPath, result.newCode, 'utf8');
    // Count line differences
    const srcLines = source.split(/\r?\n/);
    const outLines = result.newCode.split(/\r?\n/);
    let diffCount = 0;
    for (let i = 0; i < Math.max(srcLines.length, outLines.length); i++) {
      if ((srcLines[i]||'') !== (outLines[i]||'')) diffCount++;
    }
    console.log('Total line changes:', diffCount);
    console.log('Fixed file written to', outPath);
  } catch (e) {
    console.error('Test script error', e.message);
  }
})();
