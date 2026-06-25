import { useState, useEffect, useRef } from 'react';
import { listDocuments, uploadDocument, deleteDocument } from '../services/api';
import { UploadCloud, File, Trash2, Loader2, AlertCircle, Calendar, MessageSquare, ShieldAlert } from 'lucide-react';

function DocList({ onSelectDocument }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await listDocuments();
      if (data.success) {
        setDocuments(data.documents);
      } else {
        setError(data.message || 'Failed to load documents.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the gateway backend to fetch documents.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Poll database if there are processing documents to update status automatically
  useEffect(() => {
    fetchDocuments(true);
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    let interval;
    if (hasProcessing) {
      interval = setInterval(() => {
        fetchDocuments(false); // Poll silently in background
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [documents]);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15 MB limit.');
      return;
    }

    setUploading(true);
    setError('');
    
    try {
      const data = await uploadDocument(file);
      if (data.success) {
        // Refresh document list (will start polling automatically since status is 'processing')
        await fetchDocuments(false);
      } else {
        setError(data.message || 'Failed to upload document.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error uploading document to server.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Avoid selecting the card
    if (!window.confirm('Are you sure you want to delete this document and its chat history?')) {
      return;
    }

    try {
      const data = await deleteDocument(id);
      if (data.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
      } else {
        setError(data.message || 'Failed to delete document.');
      }
    } catch (err) {
      console.error(err);
      setError('Error deleting document.');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="doc-list-workspace animate-fade-in">
      <div className="doc-list-header">
        <h2>Document Workspace</h2>
        <p>Upload and manage PDFs, which are chunked, vectorized, and ready for grounded RAG conversations.</p>
      </div>

      {error && (
        <div className="error-banner glass-panel animate-fade-in">
          <AlertCircle size={18} className="text-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Zone */}
      <div 
        className={`upload-zone glass-panel ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="file-input-hidden"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="upload-state">
            <Loader2 className="spinner text-secondary-icon" size={40} />
            <h3>Processing PDF File...</h3>
            <p>Uploading to gateway and sending to ML Microservice for page extraction, chunking, and embedding generation.</p>
          </div>
        ) : (
          <div className="upload-state">
            <UploadCloud size={44} className="upload-icon-glow" />
            <h3>Drag & Drop PDF Here</h3>
            <p>or click to browse files (Max 15MB, PDF only)</p>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="documents-section">
        <h3>Indexed Documents ({documents.length})</h3>
        
        {loading ? (
          <div className="doc-list-loading">
            <Loader2 className="spinner text-primary-icon" size={32} />
            <span>Loading documents...</span>
          </div>
        ) : documents.length > 0 ? (
          <div className="doc-grid">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className={`doc-card glass-panel ${doc.status === 'ready' ? 'doc-card-ready' : ''}`}
                onClick={() => doc.status === 'ready' && onSelectDocument(doc)}
              >
                <div className="doc-card-header">
                  <div className="doc-info">
                    <File size={22} className="doc-file-icon" />
                    <div className="doc-details">
                      <h4 title={doc.filename}>{doc.filename}</h4>
                      <div className="doc-dates">
                        <Calendar size={12} />
                        <span>{formatDate(doc.uploaded_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    className="btn-delete-doc" 
                    onClick={(e) => handleDelete(e, doc.id)}
                    title="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="doc-card-body">
                  <div className="doc-stats">
                    <div className="doc-stat">
                      <span className="stat-num">{doc.page_count || '-'}</span>
                      <span className="stat-lbl">Pages</span>
                    </div>
                    <div className="doc-stat">
                      <span className="stat-num">{doc.chunk_count || '-'}</span>
                      <span className="stat-lbl">Chunks</span>
                    </div>
                  </div>

                  <div className="doc-status-pill">
                    {doc.status === 'processing' ? (
                      <span className="badge badge-warning pulsing-badge-anim">
                        <Loader2 size={12} className="spinner" />
                        <span>Processing</span>
                      </span>
                    ) : doc.status === 'ready' ? (
                      <span className="badge badge-success">
                        <span>Ready to Chat</span>
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <span>Failed</span>
                      </span>
                    )}
                  </div>
                </div>

                {doc.status === 'ready' && (
                  <div className="doc-card-footer">
                    <MessageSquare size={14} />
                    <span>Open chat session</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-docs-card glass-panel">
            <File size={36} className="text-muted" />
            <h4>No Documents Found</h4>
            <p>Upload a PDF above to begin. We'll automatically partition the text and build a vector database for semantic search.</p>
          </div>
        )}
      </div>

      <style>{`
        .doc-list-workspace {
          display: flex;
          flex-direction: column;
          gap: 24px;
          text-align: left;
        }

        .doc-list-header h2 {
          font-size: 1.75rem;
          margin-bottom: 4px;
        }

        .doc-list-header p {
          font-size: 0.95rem;
          color: var(--text-secondary);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-left: 4px solid var(--color-danger);
          background: rgba(239, 68, 68, 0.05);
          color: #fca5a5;
        }

        /* Drag and Drop Zone */
        .upload-zone {
          border: 2px dashed var(--border-light);
          padding: 44px 20px;
          text-align: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .upload-zone:hover {
          border-color: var(--color-secondary);
          background: rgba(6, 182, 212, 0.02);
        }

        .upload-zone.drag-active {
          border-color: var(--color-secondary);
          background: var(--color-secondary-glow);
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.1);
        }

        .upload-zone.uploading {
          pointer-events: none;
          border-color: var(--border-light);
        }

        .file-input-hidden {
          display: none;
        }

        .upload-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .upload-icon-glow {
          color: var(--text-secondary);
          transition: var(--transition-smooth);
        }

        .upload-zone:hover .upload-icon-glow {
          color: var(--color-secondary);
          filter: drop-shadow(0 0 8px var(--color-secondary));
        }

        .upload-state h3 {
          font-size: 1.2rem;
          color: var(--text-primary);
        }

        .upload-state p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        /* Document Grid */
        .documents-section h3 {
          font-size: 1.2rem;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .doc-list-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: var(--text-secondary);
        }

        .doc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .doc-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 180px;
          transition: var(--transition-smooth);
        }

        .doc-card-ready {
          cursor: pointer;
        }

        .doc-card-ready:hover {
          transform: translateY(-2px);
          border-color: var(--color-secondary-border);
          box-shadow: 0 10px 20px rgba(6, 182, 212, 0.05);
        }

        .doc-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .doc-info {
          display: flex;
          gap: 10px;
          overflow: hidden;
          width: calc(100% - 24px);
        }

        .doc-file-icon {
          color: var(--color-secondary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .doc-details {
          overflow: hidden;
          text-align: left;
        }

        .doc-details h4 {
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-primary);
        }

        .doc-dates {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .btn-delete-doc {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: var(--transition-smooth);
          flex-shrink: 0;
        }

        .btn-delete-doc:hover {
          color: var(--color-danger);
          background: rgba(239, 68, 68, 0.08);
        }

        .doc-card-body {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 16px;
          border-top: 1px solid var(--border-light);
          padding-top: 12px;
        }

        .doc-stats {
          display: flex;
          gap: 16px;
        }

        .doc-stat {
          display: flex;
          flex-direction: column;
        }

        .stat-num {
          font-family: var(--font-mono);
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1;
        }

        .stat-lbl {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .doc-card-footer {
          margin-top: 12px;
          border-top: 1px solid var(--border-light);
          padding-top: 8px;
          font-size: 0.8rem;
          font-family: var(--font-heading);
          font-weight: 500;
          color: var(--color-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: var(--transition-smooth);
        }

        .doc-card:hover .doc-card-footer {
          color: #fff;
        }

        .pulsing-badge-anim {
          animation: pulse-glow-badge 1.8s infinite ease-in-out;
        }

        @keyframes pulse-glow-badge {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.5; }
        }

        .empty-docs-card {
          padding: 48px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .empty-docs-card h4 {
          font-size: 1.2rem;
        }

        .empty-docs-card p {
          max-width: 420px;
          font-size: 0.9rem;
        }

        .text-danger { color: var(--color-danger); }
        .text-secondary-icon { color: var(--color-secondary); }
        .text-primary-icon { color: var(--color-primary); }
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

export default DocList;
