const fs = require('fs');
const path = require('path');
const axios = require('./backend/node_modules/axios');

// Inline applyMultiLineFix (same as before)
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

// Recursively collect .js files (excluding node_modules and .git)
function collectJsFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
      collectJsFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

(async () => {
  try {
    const projectRoot = path.resolve('.');
    const jsFiles = collectJsFiles(projectRoot);
    console.log('Found', jsFiles.length, 'JavaScript files to review.');
    for (const filePath of jsFiles) {
      console.log('\n=== Reviewing', filePath, '===');
      const source = fs.readFileSync(filePath, 'utf8');
      const resp = await axios.post('http://localhost:5000/api/review', {
        code: source,
        language: 'javascript'
      });
      const data = resp.data;
      if (!data.success) {
        console.error('Review API error for', filePath, data);
        continue;
      }
      const issues = (data.data && data.data.issues) || [];
      console.log('  Issues returned:', issues.length);
      let currentCode = source;
      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const result = applyMultiLineFix(currentCode, issue);
        if (!result.success) {
          console.warn('  Patch failed at issue', i + 1, 'stopping for this file');
          break;
        }
        currentCode = result.newCode;
      }
      const fixedPath = filePath.replace(/\.js$/, '_fixed.js');
      fs.writeFileSync(fixedPath, currentCode, 'utf8');
      console.log('  Fixed file written to', fixedPath);
    }
    console.log('\nAll files processed.');
  } catch (err) {
    console.error('Error during batch review:', err.message);
  }
})();
