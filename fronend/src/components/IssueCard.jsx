import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, ChevronDown, ChevronRight, Copy, Check, Wand2, CheckCircle2, BookOpen } from 'lucide-react';

function IssueCard({ issue, issueIndex, onApplyFix, isFixed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { severity, line, category, description, suggestion, replacement_code, guideline_citation } = issue;

  const severityLower = severity?.toLowerCase() || 'suggestion';

  const severityConfig = {
    critical:   { icon: AlertOctagon, color: 'var(--ide-red)',    borderColor: 'var(--ide-red)' },
    warning:    { icon: AlertTriangle, color: 'var(--ide-yellow)', borderColor: 'var(--ide-yellow)' },
    suggestion: { icon: Info,          color: 'var(--ide-purple)', borderColor: 'var(--ide-purple)' }
  };

  const cfg = isFixed
    ? { icon: CheckCircle2, color: 'var(--ide-green)', borderColor: 'var(--ide-green)' }
    : (severityConfig[severityLower] || severityConfig.suggestion);

  const SeverityIcon = cfg.icon;

  const handleCopy = async (e) => {
    e.stopPropagation();
    const text = replacement_code || suggestion;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleApplyFixClick = (e) => {
    e.stopPropagation();
    if (onApplyFix && !isFixed) onApplyFix(issue, issueIndex);
  };

  const formatCategory = (cat) => {
    if (!cat) return 'General';
    return cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  /* ---- Inline action button ---- */
  const SmallBtn = ({ onClick, children, title, active, activeColor }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        border: `1px solid ${active ? (activeColor || 'var(--ide-green)') : 'var(--ide-border-light)'}`,
        background: active ? 'rgba(78,201,176,0.1)' : 'transparent',
        color: active ? (activeColor || 'var(--ide-green)') : 'var(--ide-text-secondary)',
        cursor: active ? 'default' : 'pointer',
        transition: 'var(--ide-transition)'
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        background: 'var(--ide-bg-card)',
        border: '1px solid var(--ide-border)',
        borderLeft: `3px solid ${cfg.borderColor}`,
        borderRadius: 5,
        cursor: 'pointer',
        transition: 'var(--ide-transition)',
        opacity: isFixed ? 0.7 : 1
      }}
      onClick={() => setIsOpen(!isOpen)}
    >
      {/* ── Header row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        flexWrap: 'wrap'
      }}>
        {isOpen
          ? <ChevronDown size={14} style={{ color: 'var(--ide-text-secondary)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--ide-text-secondary)', flexShrink: 0 }} />
        }
        <SeverityIcon size={14} style={{ color: cfg.color, flexShrink: 0 }} />

        {/* severity badge */}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: cfg.color,
          letterSpacing: '0.03em'
        }}>
          {isFixed ? 'Fixed' : severity}
        </span>

        {/* category pill */}
        <span style={{
          fontSize: 10,
          padding: '1px 6px',
          borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--ide-text-secondary)'
        }}>
          {formatCategory(category)}
        </span>

        {/* compliance badge */}
        {guideline_citation && (
          <span style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'rgba(6,182,212,0.12)',
            color: 'var(--ide-cyan)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3
          }}>
            <BookOpen size={9} /> Compliance
          </span>
        )}

        {/* line badge */}
        {line && (
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-editor)',
            padding: '1px 6px',
            borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--ide-text-primary)'
          }}>
            Ln {line}
          </span>
        )}

        {/* one-line preview */}
        <span style={{
          flex: 1,
          fontSize: 12,
          color: 'var(--ide-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0
        }}>
          {isFixed
            ? <span style={{ color: 'var(--ide-green)', fontStyle: 'italic' }}>Fix applied to line {line}</span>
            : (description?.length > 70 ? description.substring(0, 70) + '…' : description)
          }
        </span>
      </div>

      {/* ── Expanded Body ── */}
      {isOpen && (
        <div
          style={{
            padding: '0 10px 10px 30px',
            borderTop: '1px solid var(--ide-border)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Full description */}
          <div style={{ marginTop: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ide-text-secondary)', marginBottom: 4, letterSpacing: '0.04em' }}>Description</div>
            <p style={{ fontSize: 12, color: 'var(--ide-text-primary)', lineHeight: 1.6, margin: 0 }}>{description}</p>
          </div>

          {/* Guideline citation callout */}
          {guideline_citation && (
            <div style={{
              padding: '8px 10px',
              marginBottom: 10,
              background: 'rgba(6,182,212,0.06)',
              borderLeft: '3px solid var(--ide-cyan)',
              borderRadius: 3,
              fontSize: 12
            }}>
              <strong style={{ color: 'var(--ide-cyan)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <BookOpen size={12} /> Architectural Guideline
              </strong>
              <p style={{ marginTop: 3, color: 'var(--ide-text-primary)', margin: '3px 0 0' }}>{guideline_citation}</p>
            </div>
          )}

          {/* Suggestion + code block */}
          {(suggestion || replacement_code) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ide-text-secondary)', letterSpacing: '0.04em' }}>Suggested Fix</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {line && onApplyFix && (replacement_code || suggestion) && (
                    <SmallBtn onClick={handleApplyFixClick} title={isFixed ? 'Already applied' : 'Apply auto-fix'} active={isFixed} activeColor="var(--ide-green)">
                      {isFixed ? <Check size={11} /> : <Wand2 size={11} />}
                      <span>{isFixed ? 'Applied' : 'Auto-Fix'}</span>
                    </SmallBtn>
                  )}
                  <SmallBtn onClick={handleCopy} title="Copy fix">
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </SmallBtn>
                </div>
              </div>

              {suggestion && (
                <p style={{ fontSize: 12, color: 'var(--ide-text-secondary)', lineHeight: 1.5, marginBottom: replacement_code ? 6 : 0 }}>
                  {suggestion}
                </p>
              )}

              {replacement_code && (
                <pre style={{
                  background: '#1a1a1a',
                  border: '1px solid var(--ide-border)',
                  borderRadius: 4,
                  padding: '8px 10px',
                  margin: 0,
                  overflow: 'auto',
                  fontFamily: 'var(--font-editor)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#d4d4d4'
                }}>
                  <code>{replacement_code}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IssueCard;
