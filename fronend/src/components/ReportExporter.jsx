import { useState } from 'react';
import { Download, Copy, FileText, Check, ShieldAlert, Sparkles } from 'lucide-react';

function ReportExporter({ code, language, result }) {
  const [copied, setCopied] = useState(false);
  const reviewData = result?.data || result;

  if (!reviewData || typeof reviewData.overall_score === 'undefined') {
    return (
      <div className="report-exporter-workspace animate-fade-in">
        <div className="workspace-header">
          <h2>Report Exporter</h2>
          <p>Export your comprehensive AI code audit reports as clean Markdown or HTML documents.</p>
        </div>

        <div className="empty-report-card glass-panel">
          <ShieldAlert size={36} className="text-muted" />
          <h4>No Active Report Available</h4>
          <p>Please run a code review in the **Code Sandbox** or **Project Reviewer** first. Once the review is complete, we will automatically generate a downloadable audit report here.</p>
        </div>
        
        <style>{`
          .report-exporter-workspace {
            display: flex;
            flex-direction: column;
            gap: 20px;
            text-align: left;
          }
          .empty-report-card {
            padding: 60px 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            justify-content: center;
            margin-top: 20px;
          }
          .empty-report-card h4 {
            font-size: 1.25rem;
          }
          .empty-report-card p {
            max-width: 380px;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }
        `}</style>
      </div>
    );
  }

  const { overall_score, summary, issues = [] } = reviewData;
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // ==========================================
  // Markdown Report Generator
  // ==========================================
  const generateMarkdownReport = () => {
    let md = `# DevMind AI Code Audit Report\n\n`;
    md += `**Date**: ${dateStr}  \n`;
    md += `**Language**: ${language.toUpperCase()}  \n`;
    md += `**Overall Quality Score**: **${overall_score}/10**\n\n`;
    
    md += `## 1. Executive Summary\n`;
    md += `${summary || "Code review completed successfully."}\n\n`;
    
    md += `## 2. Issues Summary Table\n\n`;
    md += `| Line | Category | Severity | Description | Suggested Fix |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    
    issues.forEach(issue => {
      const lineStr = issue.line ? `Line ${issue.line}` : "General";
      const categoryStr = issue.category ? issue.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "General";
      const severityStr = issue.severity ? issue.severity.toUpperCase() : "SUGGESTION";
      const descStr = issue.description ? issue.description.replace(/\n/g, ' ') : "-";
      const sugStr = issue.suggestion ? `\`${issue.suggestion.replace(/\n/g, ' ').substring(0, 50)}${issue.suggestion.length > 50 ? "..." : ""}\`` : "-";
      
      md += `| ${lineStr} | ${categoryStr} | **${severityStr}** | ${descStr} | ${sugStr} |\n`;
    });
    
    md += `\n## 3. Detailed Findings & Action Items\n\n`;
    
    issues.forEach((issue, idx) => {
      const lineStr = issue.line ? `Line ${issue.line}` : "General Scope";
      const categoryStr = issue.category ? issue.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "General";
      const severityStr = issue.severity ? issue.severity.toUpperCase() : "SUGGESTION";
      
      md += `### [Finding #${idx + 1}] ${categoryStr} - ${severityStr} (${lineStr})\n`;
      md += `**Description**: ${issue.description}\n\n`;
      if (issue.suggestion) {
        md += `**Recommended Fix**:\n\n`;
        md += `\`\`\`${language}\n${issue.suggestion}\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    });

    md += `*Report generated automatically by the DevMind AI platform.*`;
    return md;
  };

  const handleDownloadMarkdown = () => {
    const mdContent = generateMarkdownReport();
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DevMind-Audit-Report-${language}-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyHtml = async () => {
    const mdContent = generateMarkdownReport();
    
    // Quick simple HTML converter for copying
    let html = `<h1>DevMind AI Code Audit Report</h1>`;
    html += `<p><strong>Date:</strong> ${dateStr}</p>`;
    html += `<p><strong>Language:</strong> ${language.toUpperCase()}</p>`;
    html += `<p><strong>Overall Quality Score:</strong> ${overall_score}/10</p>`;
    html += `<h2>1. Executive Summary</h2>`;
    html += `<p>${summary}</p>`;
    html += `<h2>2. Detailed Findings</h2>`;
    
    issues.forEach((issue, idx) => {
      const lineStr = issue.line ? `Line ${issue.line}` : "General Scope";
      const categoryStr = issue.category ? issue.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "General";
      const severityStr = issue.severity ? issue.severity.toUpperCase() : "SUGGESTION";
      
      html += `<div style="border-left: 4px solid #8b5cf6; padding-left: 14px; margin-bottom: 24px;">`;
      html += `<h3>[Finding #${idx + 1}] ${categoryStr} (${lineStr})</h3>`;
      html += `<p><strong>Severity:</strong> ${severityStr}</p>`;
      html += `<p><strong>Description:</strong> ${issue.description}</p>`;
      if (issue.suggestion) {
        html += `<p><strong>Recommended Fix:</strong></p><pre style="background: #1e1e2e; color: #fff; padding: 12px; border-radius: 6px;"><code>${issue.suggestion}</code></pre>`;
      }
      html += `</div>`;
    });

    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

  return (
    <div className="report-exporter-workspace animate-fade-in">
      <div className="workspace-header">
        <div>
          <h2>Report Exporter</h2>
          <p>Download your comprehensive code review report as a structured Markdown file or copy the HTML format.</p>
        </div>
        
        <div className="exporter-actions">
          <button className="btn-secondary" onClick={handleCopyHtml}>
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            <span>{copied ? 'Copied HTML!' : 'Copy HTML'}</span>
          </button>
          
          <button className="btn-primary" onClick={handleDownloadMarkdown}>
            <Download size={16} />
            <span>Download Markdown</span>
          </button>
        </div>
      </div>

      {/* Report Paper Preview Container */}
      <div className="report-preview-container glass-panel">
        <div className="report-document">
          {/* Header */}
          <div className="doc-header">
            <div className="doc-branding">
              <Sparkles size={24} className="text-primary-icon" />
              <div>
                <h2>DevMind AI Audit Report</h2>
                <span>Static Analysis & Quality Assurance</span>
              </div>
            </div>
            <div className="doc-metadata">
              <div className="meta-item">
                <span className="meta-lbl">Date:</span>
                <span className="meta-val">{dateStr}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Language:</span>
                <span className="meta-val font-mono">{language.toUpperCase()}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Quality Score:</span>
                <span className="meta-val font-mono text-primary">{overall_score}/10</span>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <div className="doc-section">
            <h3 className="section-header">1. Executive Summary</h3>
            <p className="summary-text">{summary || "Code review completed successfully. The identified branch complex structures, performance constraints, and coding standards are detailed in the findings below."}</p>
          </div>

          {/* Section 2 */}
          <div className="doc-section">
            <h3 className="section-header">2. Findings Matrix</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{issue.line ? `Line ${issue.line}` : "General"}</td>
                    <td>{issue.category ? issue.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "General"}</td>
                    <td>
                      <span className={`badge ${
                        issue.severity?.toLowerCase() === 'critical' ? 'badge-danger' :
                        issue.severity?.toLowerCase() === 'warning' ? 'badge-warning' : 'badge-primary'
                      }`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="table-desc-cell">{issue.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3 */}
          <div className="doc-section">
            <h3 className="section-header">3. Detailed Action Items</h3>
            <div className="action-items-list">
              {issues.map((issue, idx) => (
                <div key={idx} className="action-item-block">
                  <div className="action-item-header">
                    <span className="action-item-title">
                      Finding #{idx + 1} &mdash; {issue.category ? issue.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "General"}
                    </span>
                    <span className="font-mono text-muted">
                      {issue.line ? `Line ${issue.line}` : "General Scope"}
                    </span>
                  </div>
                  
                  <p className="action-item-desc">{issue.description}</p>
                  
                  {issue.suggestion && (
                    <div className="action-item-code-box">
                      <span className="code-box-lbl">Recommended Fix:</span>
                      <pre className="code-box-pre">
                        <code>{issue.suggestion}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="doc-footer text-muted border-top">
            <span>Report compiled securely. DevMind Review Engine.</span>
          </div>
        </div>
      </div>

      <style>{`
        .report-exporter-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
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

        .exporter-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Paper Document Styles */
        .report-preview-container {
          background: rgba(10, 12, 20, 0.4);
          padding: 40px;
          border-radius: 12px;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
          overflow-x: auto;
        }

        .report-document {
          background: rgba(18, 22, 36, 0.9);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 48px;
          max-width: 800px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }

        @media (max-width: 600px) {
          .report-document {
            padding: 24px;
          }
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid var(--border-light);
          padding-bottom: 20px;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .doc-branding {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .doc-branding h2 {
          font-size: 1.4rem;
          font-weight: 700;
        }

        .doc-branding span {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 500;
        }

        .doc-metadata {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: right;
          font-size: 0.85rem;
        }

        @media (max-width: 600px) {
          .doc-metadata {
            text-align: left;
          }
        }

        .meta-item {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 600px) {
          .meta-item {
            justify-content: flex-start;
          }
        }

        .meta-lbl {
          color: var(--text-muted);
        }

        .meta-val {
          color: var(--text-primary);
          font-weight: 500;
        }

        .doc-section {
          margin-bottom: 32px;
        }

        .section-header {
          font-size: 1.15rem;
          border-left: 3px solid var(--color-primary);
          padding-left: 10px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .summary-text {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        /* Table */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }

        .report-table th, .report-table td {
          padding: 10px 12px;
          text-align: left;
          font-size: 0.85rem;
          border-bottom: 1px solid var(--border-light);
        }

        .report-table th {
          background: rgba(255,255,255,0.02);
          color: var(--text-primary);
          font-weight: 600;
        }

        .report-table td {
          color: var(--text-secondary);
        }

        .table-desc-cell {
          line-height: 1.4;
          max-width: 300px;
        }

        /* Action Items List */
        .action-items-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .action-item-block {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 16px;
        }

        .action-item-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 8px;
          margin-bottom: 10px;
        }

        .action-item-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .action-item-desc {
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .action-item-code-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .code-box-lbl {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .code-box-pre {
          background: rgba(10, 12, 20, 0.6);
          border: 1px solid var(--border-light);
          border-radius: 6px;
          padding: 10px;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: #e5e7eb;
          overflow-x: auto;
          line-height: 1.4;
        }

        .doc-footer {
          margin-top: 40px;
          padding-top: 16px;
          font-size: 0.75rem;
          text-align: center;
        }

        .text-primary-icon { color: var(--color-primary); }
        .text-success { color: var(--color-success); }
        .text-warning { color: var(--color-warning); }
        .text-danger { color: var(--color-danger); }
      `}</style>
    </div>
  );
}

export default ReportExporter;
