import { useState, useEffect, useRef } from 'react';
import { reviewCode } from '../services/api';
import LanguageSelector from './LanguageSelector';
import ReviewResult from './ReviewResult';
import { Terminal, Sparkles, Loader2, Play, CheckCircle } from 'lucide-react';

function CodeReviewer({ code, setCode, language, setLanguage, result, setResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [justFixedLines, setJustFixedLines] = useState([]); // Track lines that were just auto-fixed for flash animations
  const [flashGlow, setFlashGlow] = useState(false); // Green glow flash for the whole IDE
  const [fixedIssueIds, setFixedIssueIds] = useState(new Set()); // Tracks IDs of issues that were auto-fixed

  const textareaRef = useRef(null);
  const lineGutterRef = useRef(null);

  const loadingMessages = [
    "Analyzing code structure...",
    "Scanning for security vulnerabilities...",
    "Evaluating performance bottlenecks...",
    "Verifying coding best practices...",
    "Formulating optimization suggestions...",
    "Generating detailed report..."
  ];

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingMessages.length);
      }, 2000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please enter some code to review.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setFixedIssueIds(new Set()); // Reset fixed issues on new review

    try {
      const data = await reviewCode(code, language);
      if (data.success === false) {
        setError(data.error || 'Failed to generate review.');
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'An error occurred. Please ensure the backend gateway is running.');
    } finally {
      setLoading(false);
    }
  };

  // Synchronize line numbers gutter with textarea lines
  const getLines = () => {
    return code.split('\n');
  };

  const handleScroll = () => {
    if (textareaRef.current && lineGutterRef.current) {
      lineGutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Apply Auto-Fix directly into the editor code
  const handleApplyFix = (issue, issueIndex) => {
    const { line, suggestion } = issue;
    if (!line) return;

    const lines = getLines();
    if (line < 1 || line > lines.length) return;

    // Perform inline replacement
    const newLines = [...lines];
    newLines[line - 1] = suggestion; // Replace the target line with the suggestion
    const newCode = newLines.join('\n');
    
    setCode(newCode);

    // Track fixed issues
    setFixedIssueIds(prev => {
      const updated = new Set(prev);
      updated.add(issueIndex);
      return updated;
    });

    // Trigger visual feedback (green flash in editor)
    setJustFixedLines(prev => [...prev, line]);
    setFlashGlow(true);
    
    setTimeout(() => {
      setJustFixedLines(prev => prev.filter(l => l !== line));
    }, 1500);

    setTimeout(() => {
      setFlashGlow(false);
    }, 1000);
  };

  // Build a map of lines with issues for gutter highlights
  const getLineIssueMap = () => {
    const map = {};
    const reviewData = result?.data || result;
    if (reviewData && reviewData.issues) {
      reviewData.issues.forEach((issue, idx) => {
        if (issue.line && !fixedIssueIds.has(idx)) {
          const lineNum = parseInt(issue.line);
          const currentSeverity = issue.severity?.toLowerCase();
          
          // Prioritize higher severity highlights on the same line
          if (!map[lineNum] || 
              (currentSeverity === 'critical' && map[lineNum] !== 'critical') || 
              (currentSeverity === 'warning' && map[lineNum] === 'suggestion')) {
            map[lineNum] = currentSeverity;
          }
        }
      });
    }
    return map;
  };

  const lineIssueMap = getLineIssueMap();

  return (
    <div className="code-reviewer-workspace animate-fade-in">
      <div className="workspace-header">
        <div>
          <h2>Code Sandbox</h2>
          <p>Paste your code, select your language, and run a complete security and performance audit.</p>
        </div>
        <div className="workspace-actions">
          <LanguageSelector language={language} setLanguage={setLanguage} />
          
          <button 
            className="btn-primary" 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            <span>{loading ? 'Analyzing...' : 'Review Code'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner glass-panel animate-fade-in">
          <Terminal size={18} className="text-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Main IDE-Style Editor Card */}
      <div className={`ide-window glass-panel ${flashGlow ? 'flash-success-glow' : ''}`}>
        {/* Window Chrome Header */}
        <div className="ide-header">
          <div className="window-controls">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <div className="active-tab">
            <Terminal size={14} className="text-secondary" />
            <span>sandbox.{language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : language === 'python' ? 'py' : 'js'}</span>
          </div>
          <div className="ide-meta">
            <span className="badge badge-secondary">{language}</span>
          </div>
        </div>

        {/* Editor Layout */}
        <div className="editor-body">
          {/* Line Numbers Gutter with dynamic issue indicators */}
          <div className="line-gutter" ref={lineGutterRef}>
            {getLines().map((_, idx) => {
              const lineNum = idx + 1;
              const severity = lineIssueMap[lineNum];
              const isJustFixed = justFixedLines.includes(lineNum);
              
              let gutterClass = '';
              if (isJustFixed) gutterClass = 'gutter-fixed';
              else if (severity === 'critical') gutterClass = 'gutter-critical';
              else if (severity === 'warning') gutterClass = 'gutter-warning';
              else if (severity === 'suggestion') gutterClass = 'gutter-suggestion';

              return (
                <div 
                  key={lineNum} 
                  className={`line-number-cell ${gutterClass}`}
                  title={severity ? `${severity.toUpperCase()} issue on line ${lineNum}` : ''}
                >
                  <span className="line-number-text">{lineNum}</span>
                  {severity && <span className="gutter-dot-indicator"></span>}
                  {isJustFixed && <span className="gutter-check-indicator">✓</span>}
                </div>
              );
            })}
          </div>
          
          {/* Code Textarea */}
          <textarea
            ref={textareaRef}
            className="code-input-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onScroll={handleScroll}
            placeholder="Paste your code here..."
            spellCheck="false"
            disabled={loading}
          />
        </div>
      </div>

      {/* Loading Screen */}
      {loading && (
        <div className="review-loading-overlay glass-panel animate-fade-in">
          <div className="loading-content">
            <div className="loading-pulse-brain">
              <Sparkles size={40} className="glow-sparkle" />
            </div>
            <h3>Generating Code Insights</h3>
            <p className="loading-status-step">{loadingMessages[loadingStep]}</p>
            <div className="progress-bar-loading">
              <div className="progress-bar-fill" style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Results Screen */}
      {result && !loading && (
        <ReviewResult 
          result={result} 
          onApplyFix={handleApplyFix}
          fixedIssueIds={fixedIssueIds}
        />
      )}

      <style>{`
        .code-reviewer-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .workspace-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          flex-wrap: wrap;
          gap: 16px;
        }

        .workspace-header h2 {
          font-size: 1.75rem;
          margin-bottom: 4px;
        }

        .workspace-header p {
          font-size: 0.95rem;
          color: var(--text-secondary);
        }

        .workspace-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-left: 4px solid var(--color-danger);
          text-align: left;
          background: rgba(239, 68, 68, 0.05);
          color: #fca5a5;
        }

        /* IDE Editor Frame */
        .ide-window {
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-light);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          transition: box-shadow 0.3s ease-out, border-color 0.3s ease-out;
        }

        .ide-window.flash-success-glow {
          border-color: var(--color-success);
          box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);
        }

        .ide-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: rgba(13, 17, 28, 0.9);
          border-bottom: 1px solid var(--border-light);
        }

        .window-controls {
          display: flex;
          gap: 8px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .dot-red { background: #ff5f56; }
        .dot-yellow { background: #ffbd2e; }
        .dot-green { background: #27c93f; }

        .active-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-primary);
          padding: 6px 16px;
          border-radius: 6px;
          border: 1px solid var(--border-light);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-primary);
        }

        .editor-body {
          display: grid;
          grid-template-columns: 54px 1fr;
          height: 380px;
          background: rgba(10, 12, 20, 0.5);
        }

        /* Line numbers gutter with issue markers */
        .line-gutter {
          background: rgba(8, 10, 16, 0.8);
          border-right: 1px solid var(--border-light);
          padding: 16px 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          user-select: none;
          overflow-y: hidden;
        }

        .line-number-cell {
          line-height: 1.6;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-left: 6px;
          padding-right: 8px;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: var(--text-muted);
          position: relative;
          transition: background-color 0.2s;
        }

        .line-number-text {
          text-align: right;
          width: 100%;
        }

        .gutter-dot-indicator {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          display: inline-block;
          margin-left: 4px;
          flex-shrink: 0;
        }

        .gutter-check-indicator {
          font-size: 0.75rem;
          color: var(--color-success);
          margin-left: 4px;
          font-weight: bold;
          flex-shrink: 0;
        }

        /* Gutter severity highlights */
        .gutter-critical {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
        }
        .gutter-critical .gutter-dot-indicator {
          background-color: var(--color-danger);
          box-shadow: 0 0 6px var(--color-danger);
        }

        .gutter-warning {
          background: rgba(245, 158, 11, 0.08);
          color: #fde047;
        }
        .gutter-warning .gutter-dot-indicator {
          background-color: var(--color-warning);
          box-shadow: 0 0 6px var(--color-warning);
        }

        .gutter-suggestion {
          background: rgba(139, 92, 246, 0.08);
          color: #d8b4fe;
        }
        .gutter-suggestion .gutter-dot-indicator {
          background-color: var(--color-primary);
          box-shadow: 0 0 6px var(--color-primary);
        }

        .gutter-fixed {
          background: rgba(16, 185, 129, 0.15);
          color: #a7f3d0;
          animation: flash-green 1.5s ease-out forwards;
        }

        @keyframes flash-green {
          0% { background: rgba(16, 185, 129, 0.4); }
          100% { background: rgba(16, 185, 129, 0.05); }
        }

        .code-input-textarea {
          background: transparent;
          border: none;
          padding: 16px;
          color: #e5e7eb;
          font-family: var(--font-mono);
          font-size: 0.9rem;
          line-height: 1.6;
          resize: none;
          outline: none;
          overflow-y: auto;
          white-space: pre;
        }

        .code-input-textarea:focus {
          outline: none;
        }

        /* Loading Screen overlay */
        .review-loading-overlay {
          padding: 50px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-top: 24px;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 400px;
          width: 100%;
        }

        .loading-pulse-brain {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--color-primary-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          animation: pulse-brain 2s infinite ease-in-out;
          border: 1px solid var(--color-primary-border);
        }

        .glow-sparkle {
          color: var(--color-primary);
          filter: drop-shadow(0 0 8px var(--color-primary));
        }

        @keyframes pulse-brain {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 20px 10px rgba(139, 92, 246, 0.15); }
        }

        .loading-content h3 {
          font-size: 1.3rem;
          margin-bottom: 6px;
        }

        .loading-status-step {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 20px;
          font-style: italic;
          height: 20px;
        }

        .progress-bar-loading {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.05);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
          border-radius: 999px;
          transition: width 0.4s ease-out;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CodeReviewer;
