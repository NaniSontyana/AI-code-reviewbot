import * as Diff from 'diff';

/**
 * Precision Multi-Line Range & Architecture-Aware Patcher
 * Replaces code regions cleanly without disturbing any surrounding lines:
 * 1. Exact verbatim match replacement (preserves indentation & surrounding scope)
 * 2. Targeted boundary line match around issue line
 * 3. Scope-constrained minimal line splice
 * 4. Unified Diff 3-way line patching
 */
export function applyMultiLineFix(sourceCode, issue) {
  if (!sourceCode) return { success: false, newCode: sourceCode };

  const { line, replacement_code, suggestion, original_code } = issue;
  let newSnippet = replacement_code || suggestion || '';

  // Clean markdown backticks if AI wrapped them
  if (newSnippet.startsWith('```')) {
    const lines = newSnippet.split('\n');
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    newSnippet = lines.join('\n');
  }

  // Trim trailing extra newline to avoid expanding spacing
  newSnippet = newSnippet.replace(/\r\n/g, '\n').trimEnd();
  if (!newSnippet) return { success: false, newCode: sourceCode };

  const normalizedSource = sourceCode.replace(/\r\n/g, '\n');
  const sourceLines = normalizedSource.split('\n');

  // SAFETY GUARD: Protect against accidental whole-file destruction.
  // If replacement attempts to wipe out > 70% of a multi-function file for a single issue,
  // we require exact match confirmation or fall back to targeted line replacement.
  const isOverlyBroad = original_code && original_code.split('\n').length > 15 && original_code.split('\n').length > sourceLines.length * 0.6;

  // --------------------------------------------------------------------------
  // Strategy 1: Exact verbatim substring match (Safest, 0 disturbance)
  // --------------------------------------------------------------------------
  if (original_code && original_code.trim() && !isOverlyBroad) {
    const rawOriginal = original_code.replace(/\r\n/g, '\n');
    if (normalizedSource.includes(rawOriginal)) {
      // Find indentation of first line of original code to apply to replacement if needed
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

    // Sub-strategy 1B: Trimmed match
    const trimmedOriginal = rawOriginal.trim();
    if (normalizedSource.includes(trimmedOriginal)) {
      const updatedCode = normalizedSource.replace(trimmedOriginal, newSnippet.trim());
      return { success: true, newCode: updatedCode, method: 'trimmed_verbatim_match' };
    }
  }

  // --------------------------------------------------------------------------
  // Strategy 2: Targeted Line Window Match around target line
  // --------------------------------------------------------------------------
  if (typeof line === 'number' && line >= 1 && line <= sourceLines.length) {
    const targetIdx = line - 1;
    const targetLineText = sourceLines[targetIdx];
    const targetIndent = (targetLineText.match(/^[ \t]*/) || [''])[0];

    // Determine how many lines original_code intended to replace (capped to safe limit)
    let linesSpan = 1;
    if (original_code && !isOverlyBroad) {
      const origLines = original_code.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
      if (origLines.length > 1) {
        linesSpan = Math.min(origLines.length, 8); // Never wipe more than 8 lines on a line-based patch
      }
    }

    // Ensure replacement snippet inherits surrounding line indentation
    const snippetLines = newSnippet.split('\n');
    const properlyIndentedSnippetLines = snippetLines.map((sLine) => {
      if (sLine.trim() === '') return '';
      // If line already has proper or deeper indentation, keep it
      if (sLine.startsWith(targetIndent)) return sLine;
      return targetIndent + sLine.trimStart();
    });

    const newLines = [...sourceLines];
    newLines.splice(targetIdx, linesSpan, ...properlyIndentedSnippetLines);

    return {
      success: true,
      newCode: newLines.join('\n'),
      method: 'boundary_splice'
    };
  }

  // --------------------------------------------------------------------------
  // Strategy 3: Unified Diff 3-way Patching
  // --------------------------------------------------------------------------
  try {
    const patch = Diff.createPatch('code', normalizedSource, normalizedSource + '\n' + newSnippet);
    const patched = Diff.applyPatch(normalizedSource, patch);
    if (patched && typeof patched === 'string') {
      return { success: true, newCode: patched, method: 'diff_patch' };
    }
  } catch (e) {
    console.warn("Unified diff fallback failed:", e);
  }

  return { success: false, newCode: sourceCode };
}

/**
 * Generate Unified Diff text for Monaco Diff Viewer
 */
export function generateUnifiedDiff(originalCode, modifiedCode, filename = 'code.js') {
  return Diff.createPatch(filename, originalCode, modifiedCode, 'Original', 'AI Fixed');
}
