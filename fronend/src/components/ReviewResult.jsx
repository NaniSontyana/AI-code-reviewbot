import { useState } from 'react';
import ScoreBadge from './ScoreBadge';
import IssueCard from './IssueCard';
import { Filter, Eye, ShieldAlert, CheckCircle, ChevronDown } from 'lucide-react';

function ReviewResult({ result, onApplyFix, fixedIssueIds }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const reviewData = result?.data || result;

  if (!reviewData || typeof reviewData.overall_score === 'undefined') {
    return (
      <div className="ide-card" style={{ padding: 20, textAlign: 'center' }}>
        <ShieldAlert size={28} style={{ color: 'var(--ide-red)', marginBottom: 8 }} />
        <h4 style={{ color: 'var(--ide-text-bright)', marginBottom: 4, fontSize: 13 }}>Invalid Review Data</h4>
        <p style={{ color: 'var(--ide-text-secondary)', fontSize: 12 }}>
          The code review response could not be parsed. Please try again.
        </p>
      </div>
    );
  }

  const { overall_score, summary, issues = [], compliance_score } = reviewData;

  const filteredIssues = issues
    .map((issue, index) => ({ ...issue, originalIndex: index }))
    .filter(issue => {
      const sevMatch = severityFilter === 'all' || issue.severity?.toLowerCase() === severityFilter;
      const catMatch = categoryFilter === 'all' || issue.category?.toLowerCase() === categoryFilter;
      return sevMatch && catMatch;
    });

  const getSeverityCount = (sev) => {
    if (sev === 'all') return issues.length - (fixedIssueIds ? fixedIssueIds.size : 0);
    return issues.filter((i, idx) =>
      i.severity?.toLowerCase() === sev && (!fixedIssueIds || !fixedIssueIds.has(idx))
    ).length;
  };

  const getFixedCount = () => (fixedIssueIds ? fixedIssueIds.size : 0);
  const categoriesList = ['all', ...new Set(issues.map(i => i.category?.toLowerCase()).filter(Boolean))];

  const criticalCount = getSeverityCount('critical');
  const warningCount  = getSeverityCount('warning');
  const suggestionCount = getSeverityCount('suggestion');

  /* pill-style filter button */
  const FilterPill = ({ label, count, value, activeColor }) => {
    const active = severityFilter === value;
    return (
      <button
        onClick={() => setSeverityFilter(value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 4,
          border: `1px solid ${active ? (activeColor || 'var(--ide-accent)') : 'var(--ide-border-light)'}`,
          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
          color: active ? (activeColor || 'var(--ide-text-bright)') : 'var(--ide-text-secondary)',
          cursor: 'pointer',
          transition: 'var(--ide-transition)'
        }}
      >
        {label}
        <span style={{
          fontSize: 10,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
          padding: '0 4px',
          fontFamily: 'var(--font-editor)'
        }}>{count}</span>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Score + Summary Row ── */}
      <div className="ide-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
        <ScoreBadge score={overall_score} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ide-text-bright)' }}>
              Quality Score
            </span>
            {typeof compliance_score === 'number' && (
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: compliance_score >= 8 ? 'rgba(78,201,176,0.15)' : compliance_score >= 5 ? 'rgba(204,167,0,0.15)' : 'rgba(241,76,76,0.15)',
                color: compliance_score >= 8 ? 'var(--ide-green)' : compliance_score >= 5 ? 'var(--ide-yellow)' : 'var(--ide-red)',
                fontWeight: 600
              }}>
                Compliance {compliance_score}/10
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ide-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {summary || 'Code review completed. See identified issues below.'}
          </p>
        </div>
      </div>

      {/* ── Stat Counters ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: 'Critical', count: criticalCount, color: 'var(--ide-red)' },
          { label: 'Warning',  count: warningCount,  color: 'var(--ide-yellow)' },
          { label: 'Info',     count: suggestionCount, color: 'var(--ide-purple)' },
          ...(getFixedCount() > 0 ? [{ label: 'Fixed', count: getFixedCount(), color: 'var(--ide-green)' }] : [])
        ].map(s => (
          <div key={s.label} className="ide-card" style={{
            flex: 1,
            minWidth: 70,
            padding: '8px 10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: 10, color: 'var(--ide-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="ide-card" style={{
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }}>
        <Filter size={13} style={{ color: 'var(--ide-text-secondary)', flexShrink: 0 }} />
        <FilterPill label="All" count={issues.length - getFixedCount()} value="all" />
        <FilterPill label="Critical" count={criticalCount} value="critical" activeColor="var(--ide-red)" />
        <FilterPill label="Warning" count={warningCount} value="warning" activeColor="var(--ide-yellow)" />
        <FilterPill label="Info" count={suggestionCount} value="suggestion" activeColor="var(--ide-purple)" />

        {categoriesList.length > 2 && (
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                background: 'var(--ide-bg-input)',
                color: 'var(--ide-text-primary)',
                border: '1px solid var(--ide-border-light)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Categories</option>
              {categoriesList.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Issues List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ide-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Issues ({filteredIssues.length})
        </span>

        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue) => (
            <IssueCard
              key={issue.originalIndex}
              issue={issue}
              issueIndex={issue.originalIndex}
              onApplyFix={onApplyFix}
              isFixed={fixedIssueIds ? fixedIssueIds.has(issue.originalIndex) : false}
            />
          ))
        ) : (
          <div className="ide-card" style={{ padding: 24, textAlign: 'center' }}>
            <CheckCircle size={24} style={{ color: 'var(--ide-green)', marginBottom: 6 }} />
            <p style={{ fontSize: 12, color: 'var(--ide-text-secondary)', margin: 0 }}>
              No issues match the selected filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewResult;
