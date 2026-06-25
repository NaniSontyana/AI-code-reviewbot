import { BarChart3, Shield, Zap, Wrench, Eye, FileText, Cpu, HelpCircle, Code } from 'lucide-react';

function AnalyticsDashboard({ code, result }) {
  const reviewData = result?.data || result;

  // ==========================================
  // Real-time Static Code Analysis (McCabe / LOC)
  // ==========================================
  const analyzeCodeMetrics = (sourceCode) => {
    if (!sourceCode) return { loc: 0, blank: 0, comments: 0, density: 0, complexity: 1 };

    const lines = sourceCode.split('\n');
    const totalLines = lines.length;
    let blankLines = 0;
    let commentLines = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (
        trimmed.startsWith('//') || 
        trimmed.startsWith('#') || 
        trimmed.startsWith('/*') || 
        trimmed.startsWith('*') ||
        trimmed.endsWith('*/')
      ) {
        commentLines++;
      }
    });

    const codeLines = totalLines - blankLines - commentLines;
    const commentDensity = codeLines > 0 ? Math.round((commentLines / (codeLines + commentLines)) * 100) : 0;

    // Approximating Cyclomatic Complexity:
    // McCabe's formula: M = E - V + 2P
    // For a single method/block, we can approximate complexity as 1 + number of decision points.
    // Decision points: if, for, while, catch, case, &&, ||, ? (ternary)
    let complexity = 1;
    
    // Simple regex matches for control structures (tokenized roughly to avoid matching inside strings/comments)
    // We strip comments first for accuracy
    const cleanCode = sourceCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
      .replace(/\/\/.*/g, '')           // strip line comments
      .replace(/#.*/g, '');             // strip python comments

    const decisionPatterns = [
      /\bif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcatch\b/g,
      /\bcase\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g
    ];

    decisionPatterns.forEach(pattern => {
      const matches = cleanCode.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return {
      loc: totalLines,
      blank: blankLines,
      comments: commentLines,
      codeLines: codeLines > 0 ? codeLines : 0,
      density: commentDensity,
      complexity
    };
  };

  const metrics = analyzeCodeMetrics(code);

  // Get complexity rating details
  const getComplexityRating = (score) => {
    if (score <= 4) return { rating: 'Simple (Low Risk)', color: 'text-success', desc: 'Code is highly readable and easy to test.' };
    if (score <= 7) return { rating: 'Moderate (Low Risk)', color: 'text-warning', desc: 'Code has moderate branching. Keep method structures focused.' };
    if (score <= 10) return { rating: 'High Complexity (Medium Risk)', color: 'text-warning', desc: 'High number of control paths. Refactoring is recommended.' };
    return { rating: 'Very High (High Risk)', color: 'text-danger', desc: 'Extreme logical nesting. Testing and maintaining will be highly difficult. Refactoring is critical.' };
  };

  const complexityRating = getComplexityRating(metrics.complexity);

  // ==========================================
  // AI Grade Calculations (based on review result)
  // ==========================================
  const computeGrades = () => {
    if (!reviewData || !reviewData.issues) {
      return null;
    }

    const issues = reviewData.issues;

    // 1. Security Grade
    const secIssues = issues.filter(i => i.category?.toLowerCase() === 'security');
    const secCritical = secIssues.filter(i => i.severity?.toLowerCase() === 'critical').length;
    const secWarning = secIssues.filter(i => i.severity?.toLowerCase() === 'warning').length;
    let secScore = 100 - (secCritical * 35) - (secWarning * 15);
    secScore = Math.max(0, Math.min(100, secScore));

    // 2. Performance Grade
    const perfIssues = issues.filter(i => i.category?.toLowerCase() === 'performance');
    const perfCritical = perfIssues.filter(i => i.severity?.toLowerCase() === 'critical').length;
    const perfWarning = perfIssues.filter(i => i.severity?.toLowerCase() === 'warning').length;
    let perfScore = 100 - (perfCritical * 25) - (perfWarning * 10);
    perfScore = Math.max(0, Math.min(100, perfScore));

    // 3. Maintainability Grade (based on best_practices, style, and complexity)
    const maintIssues = issues.filter(i => ['best_practice', 'style', 'bug'].includes(i.category?.toLowerCase()));
    const maintCritical = maintIssues.filter(i => i.severity?.toLowerCase() === 'critical').length;
    const maintWarning = maintIssues.filter(i => i.severity?.toLowerCase() === 'warning').length;
    let maintScore = 100 - (maintCritical * 20) - (maintWarning * 8) - (metrics.complexity > 10 ? 15 : metrics.complexity > 6 ? 8 : 0);
    maintScore = Math.max(0, Math.min(100, maintScore));

    // 4. Readability / Documentation Grade (based on comment density)
    // Healthy comment density is 15% - 35%
    let readScore = 100;
    if (metrics.density < 10) readScore = 60 + (metrics.density * 2); // underdocumented
    else if (metrics.density > 45) readScore = 100 - (metrics.density - 45) * 1.5; // overcommented (noise)
    
    // Deduct slightly for style issues
    const styleIssues = issues.filter(i => i.category?.toLowerCase() === 'style').length;
    readScore = Math.max(0, Math.min(100, readScore - (styleIssues * 5)));

    const getLetterGrade = (score) => {
      if (score >= 97) return 'A+';
      if (score >= 93) return 'A';
      if (score >= 90) return 'A-';
      if (score >= 87) return 'B+';
      if (score >= 83) return 'B';
      if (score >= 80) return 'B-';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    };

    const getGradeColor = (grade) => {
      if (grade.startsWith('A')) return 'grade-success';
      if (grade.startsWith('B')) return 'grade-warning';
      if (grade.startsWith('C') || grade.startsWith('D')) return 'grade-warning';
      return 'grade-danger';
    };

    return {
      security: { score: secScore, grade: getLetterGrade(secScore), colorClass: getGradeColor(getLetterGrade(secScore)) },
      performance: { score: perfScore, grade: getLetterGrade(perfScore), colorClass: getGradeColor(getLetterGrade(perfScore)) },
      maintainability: { score: maintScore, grade: getLetterGrade(maintScore), colorClass: getGradeColor(getLetterGrade(maintScore)) },
      readability: { score: readScore, grade: getLetterGrade(readScore), colorClass: getGradeColor(getLetterGrade(readScore)) }
    };
  };

  const grades = computeGrades();

  return (
    <div className="analytics-workspace animate-fade-in">
      <div className="workspace-header">
        <div>
          <h2>Complexity Analytics</h2>
          <p>Examine code structures, comment densities, branching complexities, and AI quality scores.</p>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Left Column: Code Structure Metrics */}
        <div className="analytics-column">
          <div className="analytics-card glass-panel">
            <div className="card-header-bar">
              <FileText size={18} className="text-secondary-icon" />
              <h3>Static Code Metrics</h3>
            </div>
            
            <div className="metrics-list">
              <div className="metric-row">
                <span className="metric-lbl">Total Lines (LOC)</span>
                <span className="metric-val font-mono">{metrics.loc}</span>
              </div>
              <div className="metric-row">
                <span className="metric-lbl">Blank Lines</span>
                <span className="metric-val font-mono">{metrics.blank}</span>
              </div>
              <div className="metric-row">
                <span className="metric-lbl">Comment Lines</span>
                <span className="metric-val font-mono">{metrics.comments}</span>
              </div>
              <div className="metric-row">
                <span className="metric-lbl">Source Code Lines</span>
                <span className="metric-val font-mono">{metrics.codeLines}</span>
              </div>
              
              <div className="metric-progress-wrapper">
                <div className="metric-progress-header">
                  <span className="metric-lbl">Comment Density</span>
                  <span className="metric-val font-mono">{metrics.density}%</span>
                </div>
                <div className="progress-bar-loading">
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${metrics.density}%`,
                      background: metrics.density >= 15 && metrics.density <= 35 ? 'var(--color-success)' : 'var(--color-warning)'
                    }}
                  ></div>
                </div>
                <span className="progress-subtext text-muted">
                  Healthy density range is between 15% and 35%.
                </span>
              </div>
            </div>
          </div>

          {/* Cyclomatic Complexity Card */}
          <div className="analytics-card glass-panel">
            <div className="card-header-bar">
              <Cpu size={18} className="text-primary-icon" />
              <h3>Cyclomatic Complexity</h3>
            </div>
            <div className="complexity-body">
              <div className="complexity-score-badge">
                <span className="complexity-number font-mono">{metrics.complexity}</span>
                <span className="complexity-label">Branch Paths</span>
              </div>

              <div className="complexity-analysis">
                <h4 className={complexityRating.color}>{complexityRating.rating}</h4>
                <p>{complexityRating.desc}</p>
              </div>
            </div>
            
            <div className="complexity-info-footer text-muted border-top">
              <HelpCircle size={12} />
              <span>Complexity is calculated as 1 + decision points (if, loops, cases, logical operators). Lower is safer.</span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Grade Indicators */}
        <div className="analytics-column">
          {grades ? (
            <div className="grades-card glass-panel">
              <div className="card-header-bar">
                <BarChart3 size={18} className="text-secondary-icon" />
                <h3>AI Quality Report Card</h3>
              </div>
              
              <div className="grades-list">
                {/* Security Card */}
                <div className="grade-item">
                  <div className="grade-icon-wrapper text-danger">
                    <Shield size={20} />
                  </div>
                  <div className="grade-details">
                    <div className="grade-row-header">
                      <h4>Security Posture</h4>
                      <span className={`letter-grade ${grades.security.colorClass}`}>{grades.security.grade}</span>
                    </div>
                    <div className="progress-bar-loading">
                      <div className="progress-bar-fill bg-danger-fill" style={{ width: `${grades.security.score}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Performance Card */}
                <div className="grade-item">
                  <div className="grade-icon-wrapper text-warning">
                    <Zap size={20} />
                  </div>
                  <div className="grade-details">
                    <div className="grade-row-header">
                      <h4>Performance Index</h4>
                      <span className={`letter-grade ${grades.performance.colorClass}`}>{grades.performance.grade}</span>
                    </div>
                    <div className="progress-bar-loading">
                      <div className="progress-bar-fill bg-warning-fill" style={{ width: `${grades.performance.score}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Maintainability Card */}
                <div className="grade-item">
                  <div className="grade-icon-wrapper text-primary">
                    <Wrench size={20} />
                  </div>
                  <div className="grade-details">
                    <div className="grade-row-header">
                      <h4>Code Maintainability</h4>
                      <span className={`letter-grade ${grades.maintainability.colorClass}`}>{grades.maintainability.grade}</span>
                    </div>
                    <div className="progress-bar-loading">
                      <div className="progress-bar-fill bg-primary-fill" style={{ width: `${grades.maintainability.score}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Readability Card */}
                <div className="grade-item">
                  <div className="grade-icon-wrapper text-success">
                    <Eye size={20} />
                  </div>
                  <div className="grade-details">
                    <div className="grade-row-header">
                      <h4>Readability & Style</h4>
                      <span className={`letter-grade ${grades.readability.colorClass}`}>{grades.readability.grade}</span>
                    </div>
                    <div className="progress-bar-loading">
                      <div className="progress-bar-fill bg-success-fill" style={{ width: `${grades.readability.score}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-grades-card glass-panel">
              <Shield size={36} className="text-muted" />
              <h4>AI Quality Grade Locked</h4>
              <p>Please run a code review in the **Code Sandbox** or **Project Reviewer** to analyze your code and unlock your letter grade cards.</p>
              <div className="metrics-placeholder-card">
                <Code size={16} />
                <span>Structural static metrics (LOC and Complexity) remain active and update in real-time above.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .analytics-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }

        .analytics-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .analytics-card {
          padding: 24px;
        }

        .card-header-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 10px;
        }

        .card-header-bar h3 {
          font-size: 1.15rem;
        }

        .metrics-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.95rem;
        }

        .metric-lbl {
          color: var(--text-secondary);
        }

        .metric-val {
          color: var(--text-primary);
          font-weight: 600;
        }

        .metric-progress-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
        }

        .metric-progress-header {
          display: flex;
          justify-content: space-between;
        }

        .progress-subtext {
          font-size: 0.75rem;
          margin-top: 2px;
        }

        /* Complexity Card */
        .complexity-body {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 20px;
          align-items: center;
        }

        .complexity-score-badge {
          width: 90px;
          height: 90px;
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: var(--glass-shadow);
        }

        .complexity-number {
          font-size: 2.2rem;
          font-weight: 700;
          line-height: 1;
          color: var(--text-primary);
        }

        .complexity-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-top: 4px;
        }

        .complexity-analysis h4 {
          font-size: 1.05rem;
          margin-bottom: 6px;
        }

        .complexity-analysis p {
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .complexity-info-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          padding-top: 12px;
          font-size: 0.75rem;
        }

        /* Grades Report Card */
        .grades-card {
          padding: 24px;
          height: 100%;
        }

        .grades-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .grade-item {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 16px;
          align-items: center;
        }

        .grade-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .grade-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .grade-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .grade-row-header h4 {
          font-size: 1rem;
          font-family: var(--font-sans);
          font-weight: 500;
        }

        .letter-grade {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 700;
          line-height: 1;
        }

        .grade-success { color: var(--color-success); }
        .grade-warning { color: var(--color-warning); }
        .grade-danger { color: var(--color-danger); }

        .bg-danger-fill { background: linear-gradient(90deg, var(--color-danger), #f43f5e); }
        .bg-warning-fill { background: linear-gradient(90deg, var(--color-warning), #fb7185); }
        .bg-primary-fill { background: linear-gradient(90deg, var(--color-primary), #a78bfa); }
        .bg-success-fill { background: linear-gradient(90deg, var(--color-success), #34d399); }

        /* Empty Grades Card */
        .empty-grades-card {
          padding: 60px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          justify-content: center;
          height: 100%;
        }

        .empty-grades-card h4 {
          font-size: 1.25rem;
        }

        .empty-grades-card p {
          max-width: 360px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .metrics-placeholder-card {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px dashed var(--border-light);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.75rem;
          color: var(--text-muted);
          max-width: 380px;
        }

        .text-danger { color: var(--color-danger); }
        .text-warning { color: var(--color-warning); }
        .text-primary-icon { color: var(--color-primary); }
        .text-secondary-icon { color: var(--color-secondary); }
        .text-success { color: var(--color-success); }
      `}</style>
    </div>
  );
}

export default AnalyticsDashboard;
