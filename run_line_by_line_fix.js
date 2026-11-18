const fs = require('fs');
const path = require('path');
const axios = require('./backend/node_modules/axios');
// Inline applyMultiLineFix implementation (copied from frontend utils)
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


const samplePath = path.resolve('sample_test.js');
let source = fs.readFileSync(samplePath, 'utf8');

(async () => {
  try {
    const resp = await axios.post('http://localhost:5000/api/review', {
      code: source,
      language: 'javascript'
    });
    const data = resp.data;
    if (!data.success) {
      console.error('Review API error', data);
      return;
    }
    const issues = (data.data && data.data.issues) || [];
    console.log('Total issues returned:', issues.length);
    let currentCode = source;
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      console.log('\n--- Issue', i + 1, '---');
      console.log('Severity:', issue.severity);
      console.log('Line:', issue.line);
      console.log('Original code:', issue.original_code);
      console.log('Replacement code:', issue.replacement_code);
      const result = diff.applyMultiLineFix(currentCode, issue);
      console.log('Patch method:', result.method, 'success:', result.success);
      if (!result.success) {
        console.warn('Patch failed, stopping');
        break;
      }
      currentCode = result.newCode;
      const outPath = path.resolve(`fixed_step_${i + 1}.js`);
      fs.writeFileSync(outPath, currentCode, 'utf8');
      console.log('Written intermediate file:', outPath);
    }
    console.log('\nFinal fixed code written to final_fixed.js');
    fs.writeFileSync(path.resolve('final_fixed.js'), currentCode, 'utf8');
  } catch (err) {
    console.error('Error during execution:', err.message);
  }
})();
