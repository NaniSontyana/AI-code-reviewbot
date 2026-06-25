import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, ChevronDown, ChevronUp, Copy, Check, Wand2, CheckCircle2 } from 'lucide-react';

function IssueCard({ issue, issueIndex, onApplyFix, isFixed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { severity, line, category, description, suggestion } = issue;

  // Icons based on severity
  const getSeverityIcon = () => {
    if (isFixed) {
      return <CheckCircle2 size={16} className="text-success-icon" />;
    }
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <AlertOctagon size={16} className="text-danger-icon" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-warning-icon" />;
      default:
        return <Info size={16} className="text-suggestion-icon" />;
    }
  };

  // Badges classes based on severity
  const getSeverityBadgeClass = () => {
    if (isFixed) return 'badge-success';
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'badge-danger';
      case 'warning':
        return 'badge-warning';
      default:
        return 'badge-primary';
    }
  };

  // Card classes based on severity
  const getCardClass = () => {
    if (isFixed) return 'card-fixed';
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'card-critical';
      case 'warning':
        return 'card-warning';
      default:
        return 'card-suggestion';
    }
  };

  const formatCategory = (cat) => {
    if (!cat) return 'General';
    return cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const handleCopy = async (e) => {
    e.stopPropagation(); // Avoid triggering expand/collapse
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy suggestion:', err);
    }
  };

  const handleApplyFixClick = (e) => {
    e.stopPropagation(); // Avoid triggering expand/collapse
    if (onApplyFix && !isFixed) {
      onApplyFix(issue, issueIndex);
    }
  };

  return (
    <div className={`issue-card glass-panel ${getCardClass()} ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <div className="issue-header">
        <div className="issue-meta">
          {getSeverityIcon()}
          
          {/* Severity Badge */}
          <span className={`badge ${getSeverityBadgeClass()}`}>
            {isFixed ? 'Fixed' : severity}
          </span>

          {/* Category Badge */}
          <span className="badge badge-secondary">
            {formatCategory(category)}
          </span>

          {/* Line Number */}
          {line && (
            <span className="line-badge">
              Line {line}
            </span>
          )}
        </div>

        <div className="issue-toggle">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      <div className="issue-summary-line">
        {isFixed ? (
          <span className="text-success-fixed">Suggested fix successfully applied to line {line}.</span>
        ) : (
          <span>{description?.substring(0, 80)}{description?.length > 80 ? '...' : ''}</span>
        )}
      </div>

      {isOpen && (
        <div className="issue-body animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="issue-description">
            <h4>Description</h4>
            <p>{description}</p>
          </div>

          {suggestion && (
            <div className="issue-suggestion">
              <div className="suggestion-header">
                <h4>Suggested Fix</h4>
                <div className="suggestion-actions">
                  {/* One-Click Auto-Fix Button */}
                  {line && onApplyFix && (
                    <button 
                      className={`btn-apply-fix ${isFixed ? 'btn-fix-applied' : ''}`} 
                      onClick={handleApplyFixClick}
                      disabled={isFixed}
                      title={isFixed ? "Fix already applied" : "Inject this suggested code directly into the editor"}
                    >
                      {isFixed ? <Check size={14} /> : <Wand2 size={14} />}
                      <span>{isFixed ? 'Fix Applied' : 'Apply Auto-Fix'}</span>
                    </button>
                  )}

                  <button className="btn-copy-suggestion" onClick={handleCopy} title="Copy code suggestion">
                    {copied ? <Check size={14} className="text-success-icon" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Fix'}</span>
                  </button>
                </div>
              </div>
              <pre className="suggestion-code">
                <code>{suggestion}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`
        .issue-card {
          margin-bottom: 12px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          border-left: 4px solid transparent;
        }

        .issue-card:hover {
          transform: translateX(2px);
        }

        .card-critical {
          border-left-color: var(--color-danger);
        }
        .card-critical.active {
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
          border-color: var(--color-danger-border) var(--color-danger-border) var(--color-danger-border) var(--color-danger);
        }

        .card-warning {
          border-left-color: var(--color-warning);
        }
        .card-warning.active {
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.15);
          border-color: var(--color-warning-border) var(--color-warning-border) var(--color-warning-border) var(--color-warning);
        }

        .card-suggestion {
          border-left-color: var(--color-primary);
        }
        .card-suggestion.active {
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.15);
          border-color: var(--color-primary-border) var(--color-primary-border) var(--color-primary-border) var(--color-primary);
        }

        .card-fixed {
          border-left-color: var(--color-success);
          background: rgba(16, 185, 129, 0.03);
          opacity: 0.85;
        }
        .card-fixed.active {
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.1);
          border-color: var(--color-success-border) var(--color-success-border) var(--color-success-border) var(--color-success);
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .issue-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .issue-toggle {
          color: var(--text-secondary);
        }

        .issue-summary-line {
          margin-top: 10px;
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 400;
        }
        
        .issue-card.active .issue-summary-line {
          display: none;
        }

        .line-badge {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 0.75rem;
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        .issue-body {
          margin-top: 16px;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
        }

        .issue-description h4, .issue-suggestion h4 {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .issue-description p {
          font-size: 0.95rem;
          color: var(--text-primary);
          margin-bottom: 16px;
        }

        .issue-suggestion {
          display: flex;
          flex-direction: column;
        }

        .suggestion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .suggestion-actions {
          display: flex;
          gap: 8px;
        }

        .btn-copy-suggestion, .btn-apply-fix {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-light);
          border-radius: 6px;
          padding: 4px 10px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: var(--transition-smooth);
          font-family: var(--font-heading);
          font-weight: 500;
        }

        .btn-copy-suggestion:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
          border-color: var(--border-hover);
        }

        .btn-apply-fix {
          background: var(--color-primary-glow);
          border-color: var(--color-primary-border);
          color: #c084fc;
        }

        .btn-apply-fix:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: var(--color-primary);
          color: #fff;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
        }

        .btn-fix-applied, .btn-fix-applied:hover {
          background: var(--color-success-glow);
          border-color: var(--color-success-border);
          color: #34d399;
          cursor: default;
          box-shadow: none;
        }

        .suggestion-code {
          background: rgba(10, 12, 20, 0.6);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 12px;
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          line-height: 1.5;
          color: #e5e7eb;
        }

        .text-danger-icon { color: var(--color-danger); }
        .text-warning-icon { color: var(--color-warning); }
        .text-suggestion-icon { color: var(--color-primary); }
        .text-success-icon { color: var(--color-success); }
        .text-success-fixed { color: #a7f3d0; font-style: italic; }
      `}</style>
    </div>
  );
}

export default IssueCard;
