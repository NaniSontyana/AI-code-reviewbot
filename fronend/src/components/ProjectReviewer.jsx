import { useState, useRef } from 'react';
import { reviewCode } from '../services/api';
import { FolderPlus, FileCode, Folder, ChevronDown, ChevronRight, Play, CheckCircle2, Sparkles, Loader2, Info } from 'lucide-react';
import ReviewResult from './ReviewResult';

function ProjectReviewer({
  projectFiles,
  setProjectFiles,
  activeCode,
  activeLanguage,
  activeResult,
  onSelectFile,
  onUpdateFileReview,
  onCodeChange
}) {
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loadingFileReview, setLoadingFileReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [fixedIssueIds, setFixedIssueIds] = useState(new Set()); // Fixed issues per active file
  const [flashGlow, setFlashGlow] = useState(false);

  const fileInputRef = useRef(null);

  // Handle uploading multiple files / folders via input
  const handleUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    processFiles(uploadedFiles);
  };

  const processFiles = (uploadedFiles) => {
    const filesArray = [];
    
    uploadedFiles.forEach((file, index) => {
      // Basic text/code extension check
      const ext = file.name.split('.').pop().toLowerCase();
      const allowedExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'h', 'cc', 'c', 'html', 'css', 'json', 'txt'];
      
      if (allowedExtensions.includes(ext)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const relativePath = file.webkitRelativePath || file.name;
          
          filesArray.push({
            id: `file-${Date.now()}-${index}`,
            name: file.name,
            path: relativePath,
            content: event.target.result,
            reviewResult: null
          });

          // Once all files are read, update state
          if (filesArray.length === uploadedFiles.filter(f => {
            const fileExt = f.name.split('.').pop().toLowerCase();
            return allowedExtensions.includes(fileExt);
          }).length) {
            setProjectFiles(filesArray);
            setExpandedFolders(new Set(['root'])); // Auto expand top folders
            
            // Auto-select first file
            if (filesArray.length > 0) {
              setSelectedFileId(filesArray[0].id);
              onSelectFile(filesArray[0]);
            }
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const activeFile = projectFiles.find(f => f.id === selectedFileId);

  // Run AI Code Review on active file
  const handleReviewActiveFile = async () => {
    if (!activeFile) return;
    setLoadingFileReview(true);
    setReviewError('');
    setFixedIssueIds(new Set());

    try {
      const data = await reviewCode(activeCode, activeLanguage);
      if (data.success === false) {
        setReviewError(data.error || 'Failed to review file.');
      } else {
        onUpdateFileReview(activeFile.id, data);
      }
    } catch (err) {
      console.error(err);
      setReviewError(err.response?.data?.message || 'Connection failed. Please ensure the backend gateway is running.');
    } finally {
      setLoadingFileReview(false);
    }
  };

  // One-Click Auto-Fix within project reviewer
  const handleApplyFix = (issue, issueIndex) => {
    const { line, suggestion } = issue;
    if (!line || !activeFile) return;

    const lines = activeCode.split('\n');
    if (line < 1 || line > lines.length) return;

    const newLines = [...lines];
    newLines[line - 1] = suggestion;
    const newCode = newLines.join('\n');

    onCodeChange(newCode, activeFile.id);
    
    // Cache fixed issues
    setFixedIssueIds(prev => {
      const updated = new Set(prev);
      updated.add(issueIndex);
      return updated;
    });

    setFlashGlow(true);
    setTimeout(() => setFlashGlow(false), 1000);
  };

  // Build Folder Hierarchical Tree
  const buildFileTree = () => {
    const root = { name: 'root', isFolder: true, children: [] };
    
    projectFiles.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      
      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        let found = current.children.find(child => child.name === part);
        
        if (!found) {
          found = {
            name: part,
            isFolder: !isLast,
            path: parts.slice(0, idx + 1).join('/'),
            fileId: isLast ? file.id : null,
            children: isLast ? null : []
          };
          current.children.push(found);
        }
        current = found;
      });
    });

    const sortTree = (node) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);
    return root.children;
  };

  const toggleFolder = (folderPath) => {
    const updated = new Set(expandedFolders);
    if (updated.has(folderPath)) {
      updated.delete(folderPath);
    } else {
      updated.add(folderPath);
    }
    setExpandedFolders(updated);
  };

  const renderTree = (nodes, depth = 0) => {
    return nodes.map((node, index) => {
      if (node.isFolder) {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={`${node.path}-${index}`} className="tree-node-wrapper">
            <div 
              className="tree-node tree-folder"
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} className="folder-icon" />
              <span className="node-name">{node.name}</span>
            </div>
            {isExpanded && node.children && renderTree(node.children, depth + 1)}
          </div>
        );
      } else {
        const isSelected = node.fileId === selectedFileId;
        const fileObj = projectFiles.find(f => f.id === node.fileId);
        const isReviewed = fileObj && fileObj.reviewResult;
        
        return (
          <div 
            key={`${node.fileId}-${index}`}
            className={`tree-node tree-file ${isSelected ? 'active' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 20}px` }}
            onClick={() => {
              setSelectedFileId(node.fileId);
              onSelectFile(fileObj);
              setFixedIssueIds(new Set()); // Reset fixed count for new file
            }}
          >
            <FileCode size={14} className="file-icon" />
            <span className="node-name">{node.name}</span>
            {isReviewed && <span className="reviewed-badge-dot" title="Reviewed file"></span>}
          </div>
        );
      }
    });
  };

  const fileTree = buildFileTree();

  return (
    <div className="project-reviewer-workspace animate-fade-in">
      <div className="workspace-header">
        <div>
          <h2>Project Reviewer</h2>
          <p>Upload a local codebase structure to explore directories and review individual files recursively.</p>
        </div>
      </div>

      {projectFiles.length === 0 ? (
        /* Folder Upload Dropzone */
        <div 
          className="folder-upload-card glass-panel"
          onClick={() => fileInputRef.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            className="file-input-hidden"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleUpload}
          />
          <FolderPlus size={54} className="folder-upload-icon" />
          <h3>Drag & Drop or Browse Folder</h3>
          <p>Upload a local workspace or folder of source code files (JS, Python, Java, C++, etc.) to begin.</p>
        </div>
      ) : (
        /* Workspace Layout */
        <div className="project-split-layout">
          {/* File Tree Explorer Column */}
          <div className="project-sidebar glass-panel">
            <div className="sidebar-header-bar">
              <h4>Project Files</h4>
              <button 
                className="btn-text-action"
                onClick={() => {
                  setProjectFiles([]);
                  setSelectedFileId(null);
                }}
              >
                Clear Project
              </button>
            </div>
            
            <div className="file-tree-scrollbox">
              {renderTree(fileTree)}
            </div>
          </div>

          {/* Main IDE & Review Dashboard Column */}
          <div className="project-main-pane">
            {activeFile ? (
              <div className="project-editor-workspace">
                <div className="editor-top-actions">
                  <div className="file-path-header">
                    <FileCode size={16} className="text-secondary" />
                    <span>{activeFile.path}</span>
                  </div>
                  
                  <button 
                    className="btn-primary btn-run-file-review"
                    onClick={handleReviewActiveFile}
                    disabled={loadingFileReview}
                  >
                    {loadingFileReview ? (
                      <Loader2 className="spinner" size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                    <span>{loadingFileReview ? 'Reviewing...' : 'Review File'}</span>
                  </button>
                </div>

                {reviewError && (
                  <div className="error-banner glass-panel animate-fade-in">
                    <Info size={16} className="text-danger" />
                    <span>{reviewError}</span>
                  </div>
                )}

                {/* Styled IDE Window for the Active File */}
                <div className={`ide-window glass-panel ${flashGlow ? 'flash-success-glow' : ''}`}>
                  <div className="ide-header">
                    <div className="window-controls">
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <div className="active-tab">
                      <FileCode size={14} className="text-secondary" />
                      <span>{activeFile.name}</span>
                    </div>
                    <span className="badge badge-secondary">{activeLanguage}</span>
                  </div>
                  <div className="editor-body-full">
                    <textarea 
                      className="code-input-textarea full-editor"
                      value={activeCode}
                      onChange={(e) => onCodeChange(e.target.value, activeFile.id)}
                      spellCheck="false"
                      disabled={loadingFileReview}
                    />
                  </div>
                </div>

                {/* Loading State */}
                {loadingFileReview && (
                  <div className="file-review-loading glass-panel">
                    <Loader2 className="spinner text-primary-icon" size={28} />
                    <span>AI is performing an in-depth security and performance sweep on this file...</span>
                  </div>
                )}

                {/* File Specific Reviews */}
                {activeResult && !loadingFileReview && (
                  <ReviewResult 
                    result={activeResult}
                    onApplyFix={handleApplyFix}
                    fixedIssueIds={fixedIssueIds}
                  />
                )}
              </div>
            ) : (
              <div className="empty-editor-card glass-panel">
                <FileCode size={40} className="text-muted" />
                <h4>Select a file from the explorer</h4>
                <p>Click on a code file in the sidebar tree to edit, review, and apply auto-fixes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .project-reviewer-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
        }

        .workspace-header {
          text-align: left;
        }

        /* Upload zone */
        .folder-upload-card {
          border: 2px dashed var(--border-light);
          padding: 60px 20px;
          text-align: center;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
        }

        .folder-upload-card:hover {
          border-color: var(--color-secondary);
          background: rgba(6, 182, 212, 0.02);
        }

        .folder-upload-icon {
          color: var(--text-secondary);
          transition: var(--transition-smooth);
        }

        .folder-upload-card:hover .folder-upload-icon {
          color: var(--color-secondary);
          filter: drop-shadow(0 0 10px var(--color-secondary));
        }

        .folder-upload-card h3 {
          font-size: 1.4rem;
        }

        .folder-upload-card p {
          max-width: 440px;
          font-size: 0.9rem;
        }

        .file-input-hidden {
          display: none;
        }

        /* Split Workspace Layout */
        .project-split-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          height: calc(100vh - 160px);
          min-height: 500px;
          align-items: stretch;
        }

        @media (max-width: 768px) {
          .project-split-layout {
            grid-template-columns: 1fr;
          }
          .project-sidebar {
            height: 200px;
          }
        }

        /* Project Sidebar (File Tree) */
        .project-sidebar {
          background: rgba(13, 17, 28, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
        }

        .sidebar-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-light);
        }

        .sidebar-header-bar h4 {
          font-size: 0.95rem;
        }

        .btn-text-action {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-family: var(--font-heading);
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-text-action:hover {
          color: var(--color-danger);
        }

        .file-tree-scrollbox {
          flex: 1;
          overflow-y: auto;
          padding: 12px 6px;
        }

        /* Tree Node Styles */
        .tree-node-wrapper {
          display: flex;
          flex-direction: column;
        }

        .tree-node {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 28px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: var(--transition-smooth);
          user-select: none;
          text-align: left;
        }

        .tree-node:hover {
          background: rgba(255,255,255,0.03);
          color: #fff;
        }

        .tree-file.active {
          background: var(--bg-tertiary);
          color: #fff;
          border: 1px solid var(--border-light);
        }

        .tree-file.active .file-icon {
          color: var(--color-secondary);
        }

        .folder-icon {
          color: var(--color-primary);
          opacity: 0.8;
        }

        .file-icon {
          color: var(--text-muted);
        }

        .node-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reviewed-badge-dot {
          width: 6px;
          height: 6px;
          background-color: var(--color-success);
          border-radius: 50%;
          margin-left: auto;
          box-shadow: 0 0 6px var(--color-success);
        }

        /* Main Workspace Pane */
        .project-main-pane {
          overflow-y: auto;
          height: 100%;
          padding-right: 4px;
        }

        .project-editor-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .editor-top-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .file-path-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .btn-run-file-review {
          padding: 8px 16px;
          font-size: 0.85rem;
          background: linear-gradient(135deg, var(--color-secondary), #0891b2);
          box-shadow: 0 4px 10px rgba(6, 182, 212, 0.2);
        }

        .btn-run-file-review:hover {
          box-shadow: 0 6px 15px rgba(6, 182, 212, 0.3);
        }

        .editor-body-full {
          display: flex;
          height: 340px;
          background: rgba(10, 12, 20, 0.5);
        }

        .full-editor {
          width: 100%;
          height: 100%;
        }

        .empty-editor-card {
          padding: 80px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          justify-content: center;
          height: 100%;
        }

        .empty-editor-card h4 {
          font-size: 1.2rem;
        }

        .empty-editor-card p {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .file-review-loading {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 0.9rem;
          color: var(--text-secondary);
          text-align: left;
        }

        /* IDE Window Flash Glow */
        .ide-window.flash-success-glow {
          border-color: var(--color-success);
          box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);
        }

        .text-primary-icon { color: var(--color-primary); }
        .text-danger { color: var(--color-danger); }
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

export default ProjectReviewer;
