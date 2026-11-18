import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { 
  reviewCode, 
  streamReviewCode, 
  listDocuments, 
  logoutUser 
} from './services/api';

import ReviewResult from './components/ReviewResult';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ReportExporter from './components/ReportExporter';
import DocuMind from './components/DocuMind';
import ReviewHistoryDrawer from './components/ReviewHistoryDrawer';
import { applyMultiLineFix } from './utils/diffPatcher';

import {
  Code,
  FolderOpen,
  Folder,
  FileCode,
  BarChart3,
  Download,
  Sparkles,
  Brain,
  LogOut,
  Settings,
  Search,
  GitBranch,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  Play,
  Loader2,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelRight,
  PanelLeft,
  Terminal,
  BookOpen,
  FileCheck,
  Wand2,
  Copy,
  Check,
  UploadCloud,
  FileText,
  ShieldAlert,
  Info,
  Clock,
  SplitSquareVertical,
  Activity
} from 'lucide-react';

function App() {
  // User Authentication State
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // VS Code Layout Toggle States
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [isDiffView, setIsDiffView] = useState(false);

  // VS Code Dynamic Resizable Dimensions (with localStorage persistence)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('vscode_sidebar_width');
    return saved ? Math.max(160, Math.min(600, parseInt(saved, 10))) : 260;
  });
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const saved = localStorage.getItem('vscode_inspector_width');
    return saved ? Math.max(220, Math.min(800, parseInt(saved, 10))) : 380;
  });
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    const saved = localStorage.getItem('vscode_bottom_height');
    return saved ? Math.max(100, Math.min(600, parseInt(saved, 10))) : 240;
  });

  const [isResizing, setIsResizing] = useState(null); // 'sidebar' | 'inspector' | 'bottom' | null
  
  // Active Navigation View ('explorer' | 'review' | 'rag' | 'history' | 'analytics' | 'export')
  const [activeActivityView, setActiveActivityView] = useState('explorer');
  // Bottom Drawer View ('problems' | 'history' | 'ragChat' | 'analytics' | 'exporter')
  const [bottomPanelTab, setBottomPanelTab] = useState('problems');

  // Open Tabs State
  const initialSandboxCode = `// DevMind AI Studio - Professional Code Review & Compliance
function calculateDiscount(price, discount) {
  if (price < 0) {
    return 0;
  }
  
  // Potential bug: no type validation
  let finalPrice = price - (price * discount);
  
  // Security concern: logging sensitive data
  console.log("Processing price for user: " + finalPrice);
  
  return finalPrice;
}`;

  const [openTabs, setOpenTabs] = useState([
    {
      id: 'sandbox',
      name: 'sandbox.js',
      path: 'src/sandbox.js',
      content: initialSandboxCode,
      language: 'javascript',
      reviewResult: null,
      originalSnapshot: initialSandboxCode
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('sandbox');

  // Project Workspace Files (Folder upload)
  const [projectFiles, setProjectFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root', 'src']));

  // RAG Architecture Specs
  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');

  // Review Engine State
  const [loadingReview, setLoadingReview] = useState(false);
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [fixedIssueIds, setFixedIssueIds] = useState(new Set());
  const [reviewError, setReviewError] = useState('');
  const [flashGlow, setFlashGlow] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [staticLinterCount, setStaticLinterCount] = useState(0);

  // Monaco Editor Ref & Markers
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const folderInputRef = useRef(null);

  // Active open file object
  const activeTab = openTabs.find(t => t.id === activeTabId) || openTabs[0];

  // --------------------------------------------------------------------------
  // Interactive Splitter Drag Resizing (VS Code Style)
  // --------------------------------------------------------------------------
  const handleMouseDown = useCallback((type) => (e) => {
    e.preventDefault();
    setIsResizing(type);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (isResizing === 'sidebar') {
        // sidebar width is mouseX minus activity bar width (48px)
        const newWidth = Math.max(160, Math.min(window.innerWidth - 300, e.clientX - 48));
        setSidebarWidth(newWidth);
        localStorage.setItem('vscode_sidebar_width', newWidth);
      } else if (isResizing === 'inspector') {
        // inspector is on the right: width is window width minus mouseX
        const newWidth = Math.max(220, Math.min(window.innerWidth - 300, window.innerWidth - e.clientX));
        setInspectorWidth(newWidth);
        localStorage.setItem('vscode_inspector_width', newWidth);
      } else if (isResizing === 'bottom') {
        // bottom panel: height is window height minus status bar (22px) minus mouseY
        const newHeight = Math.max(100, Math.min(window.innerHeight - 150, window.innerHeight - 22 - e.clientY));
        setBottomPanelHeight(newHeight);
        localStorage.setItem('vscode_bottom_height', newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      // Trigger Monaco editor layout recalculation
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch available documents on load
  const loadDocuments = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const data = await listDocuments();
      if (data && data.success && Array.isArray(data.documents)) {
        setAvailableDocs(data.documents);
      }
    } catch (e) {
      console.warn("Could not load architecture documents:", e);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);

  // Handle Monaco Editor Mounting
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        line: e.position.lineNumber,
        col: e.position.column
      });
    });

    // Update diagnostic squiggles if review result already exists
    updateMonacoMarkers();
  };

  const decorationsCollectionRef = useRef(null);

  // Sync Diagnostic Markers (Squiggles & Antigravity Gutter Glyphs) into Monaco
  const updateMonacoMarkers = () => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const issues = activeTab?.reviewResult?.data?.issues || activeTab?.reviewResult?.issues || [];
    const markers = [];
    const decorations = [];

    issues.forEach((issue) => {
      const lineNum = Math.max(1, issue.line || 1);
      const sevLower = issue.severity?.toLowerCase() || 'suggestion';
      let severity = monacoRef.current.MarkerSeverity.Info;
      let glyphClass = 'audit-glyph-suggestion';
      let lineHighlightClass = 'audit-line-highlight-suggestion';

      if (sevLower === 'critical') {
        severity = monacoRef.current.MarkerSeverity.Error;
        glyphClass = 'audit-glyph-critical';
        lineHighlightClass = 'audit-line-highlight-critical';
      } else if (sevLower === 'warning') {
        severity = monacoRef.current.MarkerSeverity.Warning;
        glyphClass = 'audit-glyph-warning';
        lineHighlightClass = 'audit-line-highlight-warning';
      }

      const fixCode = issue.replacement_code ? `\n\nDrop-in Fix:\n${issue.replacement_code}` : '';
      const message = `[Line ${lineNum} • ${issue.category?.toUpperCase() || 'AUDIT'}] ${issue.description}\nSuggested fix: ${issue.suggestion || ''}${fixCode}`;

      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 200,
        message: message,
        severity: severity,
        source: issue.is_static_analysis ? 'DevMind Static Linter' : 'DevMind Antigravity AI'
      });

      decorations.push({
        range: new monacoRef.current.Range(lineNum, 1, lineNum, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: glyphClass,
          className: lineHighlightClass,
          glyphMarginHoverMessage: { value: `**[${issue.severity?.toUpperCase()}]** ${issue.description}` }
        }
      });
    });

    monacoRef.current.editor.setModelMarkers(model, 'devmind-audit', markers);

    // Apply gutter glyph decorations like Antigravity
    if (editorRef.current && typeof editorRef.current.createDecorationsCollection === 'function') {
      if (decorationsCollectionRef.current) {
        decorationsCollectionRef.current.clear();
      }
      decorationsCollectionRef.current = editorRef.current.createDecorationsCollection(decorations);
    }
  };

  useEffect(() => {
    updateMonacoMarkers();
  }, [activeTab?.reviewResult, activeTabId]);

  // Handle logout
  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    loadDocuments();
  };

  // Sync code edits
  const handleCodeChange = (newCode) => {
    setOpenTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, content: newCode };
      }
      return tab;
    }));

    // Also sync if it is a project file
    setProjectFiles(prev => prev.map(f => {
      if (f.id === activeTabId) {
        return { ...f, content: newCode };
      }
      return f;
    }));
  };

  // Switch or open a project file into the editor tabs
  const handleOpenFile = (file) => {
    const existing = openTabs.find(t => t.id === file.id);
    if (!existing) {
      const ext = file.name.split('.').pop().toLowerCase();
      let lang = 'javascript';
      if (ext === 'py') lang = 'python';
      else if (ext === 'java') lang = 'java';
      else if (ext === 'cpp' || ext === 'h' || ext === 'cc') lang = 'cpp';
      else if (ext === 'json') lang = 'json';
      else if (ext === 'html') lang = 'html';
      else if (ext === 'css') lang = 'css';
      else if (ext === 'ts' || ext === 'tsx') lang = 'typescript';

      setOpenTabs(prev => [...prev, {
        id: file.id,
        name: file.name,
        path: file.path || file.name,
        content: file.content,
        language: lang,
        reviewResult: file.reviewResult || null,
        originalSnapshot: file.content
      }]);
    }
    setActiveTabId(file.id);
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    if (openTabs.length === 1) return; // Keep at least one tab
    const filtered = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  // Run AI Review with real-time SSE streaming & AST static linter
  const handleRunReview = async () => {
    if (!activeTab || !activeTab.content.trim()) return;

    setLoadingReview(true);
    setReviewError('');
    setStreamTokenCount(0);
    setFixedIssueIds(new Set());
    setShowInspector(true); // Auto-open review inspector

    try {
      await streamReviewCode(
        activeTab.content,
        activeTab.language,
        selectedDocId || null,
        // On Token
        (_token) => {
          setStreamTokenCount(prev => prev + 1);
        },
        // On Complete
        (payload) => {
          if (payload.success === false) {
            setReviewError(payload.error || 'Failed to review code.');
          } else {
            const resultData = payload.data || payload;
            // Cache review into active tab
            setOpenTabs(prev => prev.map(t => {
              if (t.id === activeTabId) {
                return { ...t, reviewResult: resultData };
              }
              return t;
            }));
            // Cache review into project files if applicable
            setProjectFiles(prev => prev.map(f => {
              if (f.id === activeTabId) {
                return { ...f, reviewResult: resultData };
              }
              return f;
            }));
          }
          setLoadingReview(false);
        },
        // On Error / Fallback
        async (streamErr) => {
          console.warn("Streaming failed, falling back to standard review:", streamErr);
          try {
            const fallbackData = await reviewCode(
              activeTab.content,
              activeTab.language,
              selectedDocId || null,
              activeTab.name,
              activeTab.path
            );
            if (fallbackData.success === false) {
              setReviewError(fallbackData.error || 'Failed to review code.');
            } else {
              const resData = fallbackData.data || fallbackData;
              setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, reviewResult: resData } : t));
            }
          } catch (e) {
            setReviewError(e.response?.data?.message || streamErr || 'Review failed.');
          } finally {
            setLoadingReview(false);
          }
        },
        // On Linter diagnostics received immediately
        (linterList) => {
          if (Array.isArray(linterList)) {
            setStaticLinterCount(linterList.length);
          }
        },
        activeTab.name,
        activeTab.path
      );
    } catch (err) {
      setReviewError(err.message || 'Error communicating with gateway.');
      setLoadingReview(false);
    }
  };

  // Apply surgical Multi-Line Unified Range Auto-Fix
  const handleApplyFix = (issue, issueIndex) => {
    if (!activeTab || !activeTab.content) return;

    const result = applyMultiLineFix(activeTab.content, issue);
    if (result.success && result.newCode) {
      handleCodeChange(result.newCode);

      setFixedIssueIds(prev => {
        const updated = new Set(prev);
        updated.add(issueIndex);
        return updated;
      });

      setFlashGlow(true);
      setTimeout(() => setFlashGlow(false), 900);
    } else {
      console.warn("Auto-fix could not patch target region automatically.");
    }
  };

  // Folder Upload processor
  const handleFolderUpload = (e) => {
    const uploaded = Array.from(e.target.files);
    const filesArray = [];
    const allowed = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'h', 'cc', 'c', 'html', 'css', 'json', 'sql', 'md', 'txt'];

    uploaded.forEach((file, index) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (allowed.includes(ext)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          filesArray.push({
            id: `proj-${Date.now()}-${index}`,
            name: file.name,
            path: file.webkitRelativePath || file.name,
            content: event.target.result,
            reviewResult: null,
            originalSnapshot: event.target.result
          });

          if (filesArray.length === uploaded.filter(f => allowed.includes(f.name.split('.').pop().toLowerCase())).length) {
            setProjectFiles(filesArray);
            if (filesArray.length > 0) {
              handleOpenFile(filesArray[0]);
            }
          }
        };
        reader.readAsText(file);
      }
    });
  };

  // Build Project Tree
  const buildTree = () => {
    const root = { name: 'root', isFolder: true, children: [] };
    projectFiles.forEach(file => {
      const parts = (file.path || file.name).split('/');
      let current = root;
      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        let found = current.children.find(c => c.name === part);
        if (!found) {
          found = {
            name: part,
            isFolder: !isLast,
            path: parts.slice(0, idx + 1).join('/'),
            fileObj: isLast ? file : null,
            children: isLast ? null : []
          };
          current.children.push(found);
        }
        current = found;
      });
    });
    return root.children;
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const renderTree = (nodes, depth = 0) => {
    return nodes.map((node, i) => {
      if (node.isFolder) {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={`${node.path}-${i}`}>
            <div 
              className="tree-item"
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? <ChevronDown size={14} className="text-secondary" /> : <ChevronRight size={14} className="text-secondary" />}
              <Folder size={14} style={{ color: '#dcb67a' }} />
              <span>{node.name}</span>
            </div>
            {isExpanded && node.children && renderTree(node.children, depth + 1)}
          </div>
        );
      } else {
        const isSelected = activeTabId === node.fileObj.id;
        const hasReview = Boolean(node.fileObj.reviewResult);
        return (
          <div 
            key={`${node.fileObj.id}-${i}`}
            className={`tree-item ${isSelected ? 'active' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 22}px` }}
            onClick={() => handleOpenFile(node.fileObj)}
          >
            <FileCode size={14} style={{ color: '#4ec9b0' }} />
            <span>{node.name}</span>
            {hasReview && <span className="node-badge" style={{ color: '#4ec9b0' }}>✓</span>}
          </div>
        );
      }
    });
  };

  // Build line issue lookup map for active file
  const activeIssues = activeTab?.reviewResult?.data?.issues || activeTab?.reviewResult?.issues || [];
  const totalLines = activeTab ? activeTab.content.split('\n').length : 1;
  const criticalCount = activeIssues.filter(i => i.severity?.toLowerCase() === 'critical').length;
  const warningCount = activeIssues.filter(i => i.severity?.toLowerCase() === 'warning').length;

  // Restore a review from historical PostgreSQL snapshot
  const handleRestoreHistorySnapshot = (historyItem) => {
    const existing = openTabs.find(t => t.id === `hist-${historyItem.id}`);
    const tabObj = {
      id: `hist-${historyItem.id}`,
      name: `${historyItem.filename} (History)`,
      path: historyItem.filepath || historyItem.filename,
      content: historyItem.code,
      language: historyItem.language,
      reviewResult: {
        overall_score: historyItem.overall_score,
        compliance_score: historyItem.compliance_score,
        summary: historyItem.summary,
        issues: historyItem.issues
      },
      originalSnapshot: historyItem.code
    };

    if (!existing) {
      setOpenTabs(prev => [...prev, tabObj]);
    }
    setActiveTabId(tabObj.id);
    setShowInspector(true);
  };

  // Map language to Monaco supported IDs
  const getMonacoLanguage = (lang) => {
    switch (lang?.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'typescript':
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'python':
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'c++':
      case 'c':
        return 'cpp';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'javascript';
    }
  };

  return (
    <div className={`vscode-ide-container ${isResizing ? 'resizing-active' : ''}`}>
      {/* --------------------------------------------------------------------
          1. Top VS Code Window Title Bar
          -------------------------------------------------------------------- */}
      <header className="vscode-titlebar">
        <div className="vscode-titlebar-left">
          <div className="ide-logo-badge">
            <Sparkles size={15} style={{ color: 'var(--ide-purple)' }} />
            <span>DevMind Studio</span>
          </div>

          <nav className="ide-menus">
            <span className="ide-menu-item" onClick={() => folderInputRef.current?.click()}>File</span>
            <span className="ide-menu-item" onClick={handleRunReview}>Run</span>
            <span className="ide-menu-item" onClick={() => setShowInspector(!showInspector)}>Review</span>
            <span className="ide-menu-item" onClick={() => setShowBottomPanel(!showBottomPanel)}>Terminal</span>
            <span className="ide-menu-item" onClick={() => { setShowBottomPanel(true); setBottomPanelTab('history'); }}>History</span>
            <span className="ide-menu-item" onClick={() => setActiveActivityView('rag')}>DocuMind</span>
          </nav>
        </div>

        {/* Center Command Search Bar */}
        <div className="vscode-titlebar-center">
          <button className="ide-quick-open" onClick={handleRunReview} title="Quick Command Palette / Run AI Review">
            <Search size={13} />
            <span>Ai-code-review-bot &gt; {activeTab.path} (Ctrl+P to Run Review)</span>
          </button>
        </div>

        {/* Right Layout Toggles & Diff Switcher */}
        <div className="vscode-titlebar-right">
          <button 
            className={`ide-toolbar-btn ${isDiffView ? 'active' : ''}`}
            onClick={() => setIsDiffView(!isDiffView)} 
            title="Toggle Side-by-Side Diff View"
          >
            <SplitSquareVertical size={16} />
          </button>

          <button 
            className={`ide-toolbar-btn ${showSidebar ? 'active' : ''}`}
            onClick={() => setShowSidebar(!showSidebar)} 
            title="Toggle Primary Sidebar"
          >
            <PanelLeft size={16} />
          </button>

          <button 
            className={`ide-toolbar-btn ${showBottomPanel ? 'active' : ''}`}
            onClick={() => setShowBottomPanel(!showBottomPanel)} 
            title="Toggle Bottom Console Panel"
          >
            <PanelBottom size={16} />
          </button>

          <button 
            className={`ide-toolbar-btn ${showInspector ? 'active' : ''}`}
            onClick={() => setShowInspector(!showInspector)} 
            title="Toggle AI Review Inspector"
          >
            <PanelRight size={16} />
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ide-cyan)' }}>{user.username}</span>
              <button className="ide-toolbar-btn" onClick={handleLogout} title="Sign Out">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button className="ide-toolbar-btn" onClick={() => setActiveActivityView('rag')} title="Sign In">
              <span style={{ fontSize: 11, color: 'var(--ide-purple)' }}>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------------------
          2. Main Workspace Body (Activity Bar + Sidebar + Editor + Inspector)
          -------------------------------------------------------------------- */}
      <div className="vscode-main-body">
        {/* Far-Left Activity Bar (48px) */}
        <aside className="vscode-activitybar">
          <div className="activitybar-group">
            <button 
              className={`activitybar-item ${activeActivityView === 'explorer' ? 'active' : ''}`}
              onClick={() => { setActiveActivityView('explorer'); setShowSidebar(true); }}
              title="Explorer & Files"
            >
              <FolderOpen size={22} />
              {projectFiles.length > 0 && <span className="activity-badge">{projectFiles.length}</span>}
            </button>

            <button 
              className={`activitybar-item ${activeActivityView === 'review' ? 'active' : ''}`}
              onClick={() => { setActiveActivityView('review'); setShowInspector(true); }}
              title="AI Review & Audit"
            >
              <Sparkles size={22} />
              {activeIssues.length > 0 && (
                <span className="activity-badge" style={{ backgroundColor: criticalCount > 0 ? 'var(--ide-red)' : 'var(--ide-accent)' }}>
                  {activeIssues.length}
                </span>
              )}
            </button>

            <button 
              className={`activitybar-item ${activeActivityView === 'history' ? 'active' : ''}`}
              onClick={() => { 
                setActiveActivityView('history'); 
                setShowBottomPanel(true); 
                setBottomPanelTab('history'); 
              }}
              title="Persistent Review History (PostgreSQL)"
            >
              <Clock size={22} />
            </button>

            <button 
              className={`activitybar-item ${activeActivityView === 'rag' ? 'active' : ''}`}
              onClick={() => { setActiveActivityView('rag'); setShowSidebar(true); }}
              title="DocuMind Architecture Specs (RAG)"
            >
              <Brain size={22} />
              {availableDocs.length > 0 && <span className="activity-badge" style={{ backgroundColor: 'var(--ide-cyan)' }}>{availableDocs.length}</span>}
            </button>

            <button 
              className={`activitybar-item ${activeActivityView === 'analytics' ? 'active' : ''}`}
              onClick={() => { 
                setActiveActivityView('analytics'); 
                setShowBottomPanel(true); 
                setBottomPanelTab('analytics'); 
              }}
              title="Codebase Complexity & Metrics"
            >
              <BarChart3 size={22} />
            </button>

            <button 
              className={`activitybar-item ${activeActivityView === 'export' ? 'active' : ''}`}
              onClick={() => { 
                setActiveActivityView('export'); 
                setShowBottomPanel(true); 
                setBottomPanelTab('exporter'); 
              }}
              title="Export Audit Reports"
            >
              <Download size={22} />
            </button>
          </div>

          <div className="activitybar-group">
            <button className="activitybar-item" onClick={loadDocuments} title="Refresh Specs">
              <Settings size={20} />
            </button>
          </div>
        </aside>

        {/* Primary Sidebar (Collapsible & Draggable) */}
        {showSidebar && (
          <aside className="vscode-sidebar" style={{ width: `${sidebarWidth}px` }}>
            <div className="sidebar-titlebar">
              <span>{activeActivityView.toUpperCase()}</span>
              <button className="ide-toolbar-btn" onClick={() => setShowSidebar(false)} title="Close Sidebar">
                <PanelLeft size={14} />
              </button>
            </div>

            <div className="sidebar-scroll-content">
              {activeActivityView === 'explorer' && (
                <>
                  {/* Open Editors Section */}
                  <div className="sidebar-section">
                    <div className="section-header">
                      <div className="section-header-left">
                        <ChevronDown size={14} />
                        <span>Open Editors</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--ide-text-secondary)' }}>{openTabs.length}</span>
                    </div>
                    <div className="section-body">
                      {openTabs.map(tab => (
                        <div 
                          key={tab.id}
                          className={`tree-item ${activeTabId === tab.id ? 'active' : ''}`}
                          onClick={() => setActiveTabId(tab.id)}
                        >
                          <FileCode size={13} style={{ color: 'var(--ide-cyan)' }} />
                          <span>{tab.name}</span>
                          {tab.reviewResult && <span className="node-badge" style={{ color: 'var(--ide-green)' }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project Workspace Section */}
                  <div className="sidebar-section">
                    <div className="section-header" onClick={() => folderInputRef.current?.click()}>
                      <div className="section-header-left">
                        <ChevronDown size={14} />
                        <span>Workspace Files</span>
                      </div>
                      <UploadCloud size={14} style={{ color: 'var(--ide-text-link)', cursor: 'pointer' }} title="Upload Project Folder" />
                    </div>

                    <input 
                      type="file"
                      ref={folderInputRef}
                      style={{ display: 'none' }}
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFolderUpload}
                    />

                    <div className="section-body">
                      {projectFiles.length === 0 ? (
                        <div style={{ padding: '14px 16px', color: 'var(--ide-text-secondary)', fontSize: 11, textAlign: 'left' }}>
                          <p style={{ marginBottom: 8 }}>No local folder opened yet.</p>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: 11, width: '100%' }}
                            onClick={() => folderInputRef.current?.click()}
                          >
                            <FolderOpen size={13} />
                            <span>Open Folder...</span>
                          </button>
                        </div>
                      ) : (
                        renderTree(buildTree())
                      )}
                    </div>
                  </div>

                  {/* RAG Guidelines Section */}
                  <div className="sidebar-section">
                    <div className="section-header" onClick={() => setActiveActivityView('rag')}>
                      <div className="section-header-left">
                        <ChevronDown size={14} />
                        <span>Architecture Specs</span>
                      </div>
                      <span className="node-badge" style={{ color: 'var(--ide-cyan)' }}>{availableDocs.length}</span>
                    </div>
                    <div className="section-body">
                      {availableDocs.map(doc => (
                        <div 
                          key={doc.id}
                          className={`tree-item ${selectedDocId === doc.id ? 'active' : ''}`}
                          onClick={() => setSelectedDocId(selectedDocId === doc.id ? '' : doc.id)}
                          title="Click to toggle as active review compliance rule"
                        >
                          <BookOpen size={13} style={{ color: 'var(--ide-purple)' }} />
                          <span style={{ fontSize: 11 }}>{doc.filename}</span>
                          {selectedDocId === doc.id && <span style={{ marginLeft: 'auto', color: 'var(--ide-green)', fontSize: 10 }}>Active</span>}
                        </div>
                      ))}
                      {availableDocs.length === 0 && (
                        <div style={{ padding: '10px 16px', color: 'var(--ide-text-secondary)', fontSize: 11 }}>
                          <span>No PDF specs uploaded yet. Visit DocuMind tab to add one.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeActivityView === 'rag' && (
                <div style={{ padding: 14 }}>
                  <DocuMind user={user} onAuthSuccess={handleAuthSuccess} />
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Sidebar Resize Splitter */}
        {showSidebar && (
          <div 
            className={`ide-splitter ide-splitter-col ${isResizing === 'sidebar' ? 'resizing' : ''}`}
            onMouseDown={handleMouseDown('sidebar')}
            title="Drag to resize primary sidebar"
          />
        )}

        {/* Central Monaco Editor Area & Bottom Console */}
        <main className="vscode-editor-group">
          {/* Top Tabs Bar */}
          <div className="vscode-tabs-bar">
            <div className="tabs-list">
              {openTabs.map(tab => (
                <div 
                  key={tab.id}
                  className={`vscode-tab ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <FileCode size={14} style={{ color: 'var(--ide-cyan)' }} />
                  <span>{tab.name}</span>
                  {openTabs.length > 1 && (
                    <button className="tab-close-btn" onClick={(e) => handleCloseTab(tab.id, e)} title="Close">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="tabs-actions">
              {/* Diff View Toggle */}
              <button
                className="btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  height: 24,
                  backgroundColor: isDiffView ? 'var(--ide-bg-selected)' : 'transparent',
                  color: isDiffView ? '#fff' : 'var(--ide-text-secondary)'
                }}
                onClick={() => setIsDiffView(!isDiffView)}
                title="Toggle Diff Viewer against original snapshot"
              >
                <SplitSquareVertical size={12} />
                <span>Diff View</span>
              </button>

              {/* Architecture Spec Selector */}
              {availableDocs.length > 0 && (
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-bg-input)',
                    color: 'var(--ide-text-primary)',
                    border: '1px solid var(--ide-border-light)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Architecture Spec for Compliance Audit"
                >
                  <option value="">Spec: None (General)</option>
                  {availableDocs.map(d => (
                    <option key={d.id} value={d.id}>Spec: {d.filename}</option>
                  ))}
                </select>
              )}

              {/* Language Selector */}
              <select
                value={activeTab.language}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, language: newLang } : t));
                }}
                style={{
                  backgroundColor: 'var(--ide-bg-input)',
                  color: 'var(--ide-text-primary)',
                  border: '1px solid var(--ide-border-light)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
              </select>

              {/* Run Review Action Button */}
              <button 
                className="btn-primary" 
                style={{ padding: '4px 12px', fontSize: 11, borderRadius: 4, height: 26 }}
                onClick={handleRunReview}
                disabled={loadingReview}
              >
                {loadingReview ? (
                  <>
                    <Loader2 size={12} className="spinner" />
                    <span>{streamTokenCount > 0 ? `${streamTokenCount} tok` : 'Auditing...'}</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>{selectedDocId ? 'Audit Compliance' : 'Review Code'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Breadcrumbs Navigation */}
          <div className="vscode-breadcrumbs">
            <div className="breadcrumb-path">
              <span>workspace</span>
              <span>&gt;</span>
              <span>{activeTab.path}</span>
              {selectedDocId && (
                <>
                  <span>&gt;</span>
                  <span style={{ color: 'var(--ide-cyan)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <FileCheck size={11} />
                    {availableDocs.find(d => d.id === selectedDocId)?.filename}
                  </span>
                </>
              )}
            </div>

            <div className="breadcrumb-actions">
              {staticLinterCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ide-yellow)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Activity size={12} />
                  <span>{staticLinterCount} AST Linter Flags</span>
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--ide-text-secondary)' }}>
                {totalLines} lines
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {reviewError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              backgroundColor: 'rgba(241, 76, 76, 0.1)',
              borderBottom: '1px solid rgba(241, 76, 76, 0.3)',
              color: '#f87171',
              fontSize: 12
            }}>
              <AlertCircle size={14} />
              <span>{reviewError}</span>
            </div>
          )}

          {/* Monaco Editor Container */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {isDiffView ? (
              <DiffEditor
                height="100%"
                language={getMonacoLanguage(activeTab.language)}
                original={activeTab.originalSnapshot || activeTab.content}
                modified={activeTab.content}
                theme="vs-dark"
                options={{
                  readOnly: false,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily: "'Fira Code', Consolas, monospace",
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            ) : (
              <Editor
                height="100%"
                language={getMonacoLanguage(activeTab.language)}
                value={activeTab.content}
                theme="vs-dark"
                onChange={(value) => handleCodeChange(value || '')}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 13,
                  fontFamily: "'Fira Code', Consolas, monospace",
                  fontLigatures: true,
                  lineNumbers: 'on',
                  glyphMargin: true,
                  minimap: { enabled: true, side: 'right' },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'off',
                  renderLineHighlight: 'all',
                  renderValidationDecorations: 'on',
                  overviewRulerLanes: 3,
                  suggestOnTriggerCharacters: true,
                  formatOnPaste: true,
                  bracketPairColorization: { enabled: true }
                }}
              />
            )}
          </div>

          {/* Bottom Panel Resize Splitter Handle */}
          {showBottomPanel && (
            <div 
              className={`ide-splitter ide-splitter-row ${isResizing === 'bottom' ? 'resizing' : ''}`}
              onMouseDown={handleMouseDown('bottom')}
              title="Drag to resize console drawer"
            />
          )}

          {/* Collapsible & Resizable Bottom Panel */}
          {showBottomPanel && (
            <div className="vscode-bottom-panel" style={{ height: `${bottomPanelHeight}px` }}>
              <div className="bottom-panel-header">
                <div className="bottom-tabs">
                  <button 
                    className={`bottom-tab-btn ${bottomPanelTab === 'problems' ? 'active' : ''}`}
                    onClick={() => setBottomPanelTab('problems')}
                  >
                    Problems ({activeIssues.length})
                  </button>
                  <button 
                    className={`bottom-tab-btn ${bottomPanelTab === 'history' ? 'active' : ''}`}
                    onClick={() => setBottomPanelTab('history')}
                  >
                    Audit Snapshots (PostgreSQL)
                  </button>
                  <button 
                    className={`bottom-tab-btn ${bottomPanelTab === 'ragChat' ? 'active' : ''}`}
                    onClick={() => setBottomPanelTab('ragChat')}
                  >
                    DocuMind RAG Chat
                  </button>
                  <button 
                    className={`bottom-tab-btn ${bottomPanelTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setBottomPanelTab('analytics')}
                  >
                    Complexity Analytics
                  </button>
                  <button 
                    className={`bottom-tab-btn ${bottomPanelTab === 'exporter' ? 'active' : ''}`}
                    onClick={() => setBottomPanelTab('exporter')}
                  >
                    Audit Report Export
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="ide-toolbar-btn" onClick={() => setShowBottomPanel(false)} title="Close Panel">
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="bottom-panel-body">
                {bottomPanelTab === 'problems' && (
                  activeIssues.length === 0 ? (
                    <div style={{ color: 'var(--ide-text-secondary)', padding: 12 }}>
                      <span>No problems detected. Click "Review Code" to audit this file with AST Linter and AI.</span>
                    </div>
                  ) : (
                    <table className="problems-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Severity</th>
                          <th style={{ width: 60 }}>Line</th>
                          <th style={{ width: 120 }}>Category</th>
                          <th>Description &amp; Suggested Fix</th>
                          <th style={{ width: 110 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeIssues.map((issue, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{ 
                                color: issue.severity === 'critical' ? 'var(--ide-red)' : issue.severity === 'warning' ? 'var(--ide-yellow)' : 'var(--ide-accent)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: 11
                              }}>
                                {issue.severity}
                              </span>
                            </td>
                            <td>{issue.line || '-'}</td>
                            <td style={{ color: 'var(--ide-text-secondary)' }}>{issue.category}</td>
                            <td>
                              <div>{issue.description}</div>
                              {issue.replacement_code && (
                                <code style={{ color: 'var(--ide-green)', fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: 3, display: 'inline-block', marginTop: 3 }}>
                                  {issue.replacement_code}
                                </code>
                              )}
                            </td>
                            <td>
                              {(issue.replacement_code || issue.suggestion) && (
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '2px 8px', fontSize: 11 }}
                                  onClick={() => handleApplyFix(issue, idx)}
                                >
                                  {fixedIssueIds.has(idx) ? '✓ Fixed' : 'Auto-Fix'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {bottomPanelTab === 'history' && (
                  <ReviewHistoryDrawer onSelectReview={handleRestoreHistorySnapshot} />
                )}

                {bottomPanelTab === 'ragChat' && (
                  <DocuMind user={user} onAuthSuccess={handleAuthSuccess} />
                )}

                {bottomPanelTab === 'analytics' && (
                  <AnalyticsDashboard code={activeTab.content} result={activeTab.reviewResult} />
                )}

                {bottomPanelTab === 'exporter' && (
                  <ReportExporter code={activeTab.content} language={activeTab.language} result={activeTab.reviewResult} />
                )}
              </div>
            </div>
          )}
        </main>

        {/* Inspector Resize Splitter Handle */}
        {showInspector && (
          <div 
            className={`ide-splitter ide-splitter-col ${isResizing === 'inspector' ? 'resizing' : ''}`}
            onMouseDown={handleMouseDown('inspector')}
            title="Drag to resize AI review inspector"
          />
        )}

        {/* Right AI Review Inspector (Secondary Sidebar, Draggable) */}
        {showInspector && (
          <aside className="vscode-inspector-panel" style={{ width: `${inspectorWidth}px` }}>
            <div className="inspector-header">
              <div className="inspector-tabs">
                <span className="inspector-tab-btn active">AI AUDIT INSPECTOR</span>
              </div>
              <button className="ide-toolbar-btn" onClick={() => setShowInspector(false)} title="Close Inspector">
                <PanelRight size={14} />
              </button>
            </div>

            <div className="inspector-content-scroll">
              {activeTab.reviewResult ? (
                <ReviewResult 
                  result={activeTab.reviewResult}
                  onApplyFix={handleApplyFix}
                  fixedIssueIds={fixedIssueIds}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--ide-text-secondary)' }}>
                  <Sparkles size={36} style={{ color: 'var(--ide-purple)', marginBottom: 12, opacity: 0.8 }} />
                  <h4 style={{ color: 'var(--ide-text-bright)', fontSize: 14, marginBottom: 6 }}>Ready for Real-Time Review</h4>
                  <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
                    Click <strong>Review Code</strong> above or use <code>Ctrl + P</code> to run an in-depth AST static scan, security audit, and guideline compliance check.
                  </p>
                  <button 
                    className="btn-primary" 
                    style={{ fontSize: 12, padding: '8px 16px', width: '100%' }}
                    onClick={handleRunReview}
                    disabled={loadingReview}
                  >
                    <Play size={13} />
                    <span>Run AI Audit</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* --------------------------------------------------------------------
          3. Bottom Status Bar (VS Code Blue Strip, 22px)
          -------------------------------------------------------------------- */}
      <footer className="vscode-statusbar">
        <div className="statusbar-left">
          <div className="statusbar-item" title="Git Branch">
            <GitBranch size={12} />
            <span>main*</span>
          </div>

          <div 
            className="statusbar-item" 
            onClick={() => { setShowBottomPanel(true); setBottomPanelTab('problems'); }}
            title="Problems in file"
          >
            <AlertCircle size={12} style={{ color: criticalCount > 0 ? '#ff8080' : 'inherit' }} />
            <span>{criticalCount}</span>
            <AlertTriangle size={12} style={{ color: warningCount > 0 ? '#ffe066' : 'inherit' }} />
            <span>{warningCount}</span>
          </div>

          <div className="statusbar-item" title="Active Engine">
            <Sparkles size={11} />
            <span>Monaco + Qwen-3.8 27B</span>
          </div>

          {selectedDocId && (
            <div className="statusbar-item" title="Grounded RAG Spec Active">
              <BookOpen size={11} />
              <span>Spec: {availableDocs.find(d => d.id === selectedDocId)?.filename?.substring(0, 18)}</span>
            </div>
          )}
        </div>

        <div className="statusbar-right">
          <div className="statusbar-item">
            <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
          </div>

          <div className="statusbar-item">
            <span>Spaces: 2</span>
          </div>

          <div className="statusbar-item">
            <span>UTF-8</span>
          </div>

          <div className="statusbar-item">
            <span>{activeTab.language.toUpperCase()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
