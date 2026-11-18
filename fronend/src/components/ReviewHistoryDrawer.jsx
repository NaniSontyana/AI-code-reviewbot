import { useState, useEffect } from 'react';
import { getReviewHistory, getReviewById } from '../services/api';
import { Clock, FileCode, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';

export default function ReviewHistoryDrawer({ onSelectReview }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await getReviewHistory(40);
      if (res && res.success && Array.isArray(res.history)) {
        setHistory(res.history);
      }
    } catch (e) {
      console.warn("Could not fetch review history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleItemClick = async (item) => {
    setSelectedId(item.id);
    if (onSelectReview) {
      onSelectReview(item);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--ide-text-primary)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid var(--ide-border)',
        fontSize: 11
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--ide-text-bright)' }}>
          <Clock size={13} style={{ color: 'var(--ide-cyan)' }} />
          <span>PERSISTENT CODE AUDIT SNAPSHOTS (POSTGRESQL)</span>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ide-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11
          }}
          title="Refresh History from Database"
        >
          <RefreshCw size={12} className={loading ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* History table / list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ide-text-secondary)', fontSize: 12 }}>
            <Clock size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p>No review history recorded in PostgreSQL yet.</p>
            <p style={{ fontSize: 11, color: 'var(--ide-text-secondary)' }}>Run an AI review to generate persistent audit history.</p>
          </div>
        ) : (
          <table className="problems-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Timestamp</th>
                <th style={{ width: 150 }}>File &amp; Language</th>
                <th style={{ width: 80 }}>Quality</th>
                <th style={{ width: 90 }}>Compliance</th>
                <th style={{ width: 80 }}>Issues</th>
                <th>Summary</th>
                <th style={{ width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const isSelected = selectedId === item.id;
                const dateStr = new Date(item.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const issuesCount = Array.isArray(item.issues) ? item.issues.length : 0;
                const score = item.overall_score;

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--ide-bg-selected)' : 'transparent'
                    }}
                  >
                    <td style={{ color: 'var(--ide-text-secondary)', fontSize: 11 }}>{dateStr}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FileCode size={13} style={{ color: 'var(--ide-cyan)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--ide-text-bright)' }}>{item.filename}</span>
                        <span style={{ fontSize: 10, color: 'var(--ide-text-secondary)' }}>({item.language})</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: score >= 8 ? 'var(--ide-green)' : score >= 5 ? 'var(--ide-yellow)' : 'var(--ide-red)'
                      }}>
                        {score !== null ? `${score}/10` : '-'}
                      </span>
                    </td>
                    <td>
                      {item.compliance_score !== null ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: item.compliance_score >= 8 ? 'var(--ide-green)' : item.compliance_score >= 5 ? 'var(--ide-yellow)' : 'var(--ide-red)'
                        }}>
                          {item.compliance_score}/10
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ide-text-secondary)', fontSize: 11 }}>N/A</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                        background: issuesCount > 0 ? 'rgba(241,76,76,0.15)' : 'rgba(78,201,176,0.15)',
                        color: issuesCount > 0 ? 'var(--ide-red)' : 'var(--ide-green)'
                      }}>
                        {issuesCount} issues
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--ide-text-primary)' }}>{item.summary}</span>
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        className="btn-secondary"
                        style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
