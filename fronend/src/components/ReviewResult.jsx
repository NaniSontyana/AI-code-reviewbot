import { useState } from 'react';
import ScoreBadge from './ScoreBadge';
import IssueCard from './IssueCard';
import { Filter, Eye, ShieldAlert, CheckCircle } from 'lucide-react';

function ReviewResult({ result, onApplyFix, fixedIssueIds }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const reviewData = result?.data || result;

  if (!reviewData || typeof reviewData.overall_score === 'undefined') {
    return (
      <div className="review-error glass-panel">
        <ShieldAlert size={32} className="text-danger" />
        <h3>Invalid Review Data</h3>
        <p>The code review response format could not be parsed. Please try reviewing your code again.</p>
      </div>
    );
  }

  const { overall_score, summary, issues = [] } = reviewData;

  // Filter logic
  const filteredIssues = issues.map((issue, index) => ({ ...issue, originalIndex: index }))
    .filter(issue => {
      const severityMatch = severityFilter === 'all' || 
        issue.severity?.toLowerCase() === severityFilter.toLowerCase();
      const categoryMatch = categoryFilter === 'all' || 
        issue.category?.toLowerCase() === categoryFilter.toLowerCase();
      return severityMatch && categoryMatch;
    });

  // Calculate counts for filters
  const getSeverityCount = (sev) => {
    if (sev === 'all') return issues.length - (fixedIssueIds ? fixedIssueIds.size : 0);
    return issues.filter((i, idx) => i.severity?.toLowerCase() === sev.toLowerCase() && (!fixedIssueIds || !fixedIssueIds.has(idx))).length;
  };

  const getFixedCount = () => {
    return fixedIssueIds ? fixedIssueIds.size : 0;
  };

  const categoriesList = ['all', ...new Set(issues.map(i => i.category?.toLowerCase()).filter(Boolean))];

  return (
    <div className="review-results-container animate-fade-in">
      {/* Top Summary & Score Section */}
      <div className="summary-score-layout">
        <div className="score-card glass-panel">
          <h3>Overall Quality Score</h3>
          <p className="score-desc">Based on security, performance, and best practices.</p>
          <div className="score-badge-wrapper">
            <ScoreBadge score={overall_score} />
          </div>
        </div>

        <div className="summary-card glass-panel">
          <div className="summary-header">
            <Eye size={20} className="text-primary-icon" />
            <h3>AI Summary</h3>
          </div>
          <p className="summary-text">{summary || 'Code review completed successfully. Review the identified issues below.'}</p>
          
          <div className="issue-stats">
            <div className="stat-item">
              <span className="stat-count text-danger">{getSeverityCount('critical')}</span>
              <span className="stat-label">Critical</span>
            </div>
            <div className="stat-item">
              <span className="stat-count text-warning">{getSeverityCount('warning')}</span>
              <span className="stat-label">Warnings</span>
            </div>
            <div className="stat-item">
              <span className="stat-count text-suggestion">{getSeverityCount('suggestion')}</span>
              <span className="stat-label">Suggestions</span>
            </div>
            {getFixedCount() > 0 && (
              <div className="stat-item border-left-stat">
                <span className="stat-count text-success">{getFixedCount()}</span>
                <span className="stat-label">Fixed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="filters-bar glass-panel">
        <div className="filter-title">
          <Filter size={16} />
          <span>Filter Issues</span>
        </div>

        <div className="filter-options">
          {/* Severity Filters */}
          <div className="filter-group">
            <span className="filter-label">Severity:</span>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${severityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSeverityFilter('all')}
              >
                All <span className="filter-count">{issues.length - getFixedCount()}</span>
              </button>
              <button 
                className={`filter-btn filter-btn-critical ${severityFilter === 'critical' ? 'active' : ''}`}
                onClick={() => setSeverityFilter('critical')}
              >
                Critical <span className="filter-count">{getSeverityCount('critical')}</span>
              </button>
              <button 
                className={`filter-btn filter-btn-warning ${severityFilter === 'warning' ? 'active' : ''}`}
                onClick={() => setSeverityFilter('warning')}
              >
                Warning <span className="filter-count">{getSeverityCount('warning')}</span>
              </button>
              <button 
                className={`filter-btn filter-btn-suggestion ${severityFilter === 'suggestion' ? 'active' : ''}`}
                onClick={() => setSeverityFilter('suggestion')}
              >
                Suggestion <span className="filter-count">{getSeverityCount('suggestion')}</span>
              </button>
            </div>
          </div>

          {/* Category Filters */}
          {categoriesList.length > 1 && (
            <div className="filter-group">
              <span className="filter-label">Category:</span>
              <select 
                className="category-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
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
      </div>

      {/* Issues List */}
      <div className="issues-list-section">
        <h3 className="section-title">
          Identified Issues ({filteredIssues.length})
        </h3>
        
        {filteredIssues.length > 0 ? (
          <div className="issues-grid">
            {filteredIssues.map((issue) => (
              <IssueCard 
                key={issue.originalIndex} 
                issue={issue} 
                issueIndex={issue.originalIndex}
                onApplyFix={onApplyFix}
                isFixed={fixedIssueIds ? fixedIssueIds.has(issue.originalIndex) : false}
              />
            ))}
          </div>
        ) : (
          <div className="no-issues-card glass-panel">
            <CheckCircle size={36} className="text-success" />
            <h3>No Issues Found</h3>
            <p>Great job! No code issues match the selected filter criteria.</p>
          </div>
        )}
      </div>

      <style>{`
        .review-results-container {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          text-align: left;
        }

        .summary-score-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .summary-score-layout {
            grid-template-columns: 1fr;
          }
        }

        .score-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .score-card h3 {
          font-size: 1.1rem;
          margin-bottom: 4px;
          color: var(--text-primary);
        }

        .score-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 20px;
        }

        .score-badge-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .summary-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .summary-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .summary-header h3 {
          font-size: 1.25rem;
        }

        .summary-text {
          font-size: 1rem;
          line-height: 1.6;
          color: var(--text-primary);
          margin-bottom: 24px;
        }

        .issue-stats {
          display: flex;
          gap: 20px;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .border-left-stat {
          border-left: 1px solid var(--border-light);
          padding-left: 20px;
        }

        .stat-count {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .filters-bar {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .filter-options {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .filter-buttons {
          display: flex;
          gap: 6px;
        }

        .filter-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-light);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-family: var(--font-heading);
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .filter-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }

        .filter-btn.active {
          color: #fff;
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
        }

        .filter-btn-critical.active {
          background: var(--color-danger-glow);
          border-color: var(--color-danger-border);
          color: #f87171;
        }

        .filter-btn-warning.active {
          background: var(--color-warning-glow);
          border-color: var(--color-warning-border);
          color: #fbbf24;
        }

        .filter-btn-suggestion.active {
          background: var(--color-primary-glow);
          border-color: var(--color-primary-border);
          color: #c084fc;
        }

        .filter-count {
          font-size: 0.7rem;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          padding: 1px 5px;
          font-family: var(--font-mono);
        }

        .category-select {
          background: rgba(10, 12, 20, 0.5);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          color: #fff;
          padding: 6px 12px;
          font-family: var(--font-sans);
          font-size: 0.8rem;
          cursor: pointer;
        }

        .category-select:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .section-title {
          font-size: 1.2rem;
          margin-bottom: 16px;
        }

        .no-issues-card {
          padding: 40px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .no-issues-card h3 {
          font-size: 1.3rem;
        }

        .review-error {
          padding: 30px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .text-danger { color: var(--color-danger); }
        .text-warning { color: var(--color-warning); }
        .text-suggestion { color: var(--color-primary); }
        .text-success { color: var(--color-success); }
        .text-primary-icon { color: var(--color-primary); }
      `}</style>
    </div>
  );
}

export default ReviewResult;
