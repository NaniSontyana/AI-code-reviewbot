import { useState } from 'react';
import CodeReviewer from './components/CodeReviewer';
import ProjectReviewer from './components/ProjectReviewer';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ReportExporter from './components/ReportExporter';
import DocuMind from './components/DocuMind';
import { logoutUser } from './services/api';
import { Code, FolderOpen, BarChart3, Download, Sparkles, Brain, LogOut } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('sandbox'); // 'sandbox' | 'project' | 'analytics' | 'exporter' | 'documind'
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Failed to parse saved user from localStorage", e);
      return null;
    }
  });

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setActiveTab('sandbox');
  };
  
  // Shared global state for the active code being analyzed
  const [activeCode, setActiveCode] = useState(`// Paste your code here to get a comprehensive AI review
function calculateDiscount(price, discount) {
  if (price < 0) {
    return 0;
  }
  
  // Potential bug: no type checking
  let finalPrice = price - (price * discount);
  
  // Security concern: logging sensitive data
  console.log("Processing price for user: " + finalPrice);
  
  return finalPrice;
}`);
  const [activeLanguage, setActiveLanguage] = useState('javascript');
  const [activeResult, setActiveResult] = useState(null);
  
  // Project files state (for multi-file explorer)
  const [projectFiles, setProjectFiles] = useState([]);

  // Handles updating active file state from project reviewer
  const handleSelectFile = (file) => {
    setActiveCode(file.content);
    // Auto-detect language from extension if possible
    const ext = file.name.split('.').pop().toLowerCase();
    let lang = 'javascript';
    if (ext === 'py') lang = 'python';
    else if (ext === 'java') lang = 'java';
    else if (ext === 'cpp' || ext === 'h' || ext === 'cc') lang = 'cpp';
    setActiveLanguage(lang);
    
    // Load cached review result if it exists
    setActiveResult(file.reviewResult || null);
  };

  // Cache a review result back into the file in our project list
  const handleUpdateFileReview = (fileId, reviewData) => {
    setProjectFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, reviewResult: reviewData };
      }
      return f;
    }));
    setActiveResult(reviewData);
  };

  // Sync code edits back to project files if we are in project mode
  const handleCodeChange = (newCode, fileId) => {
    setActiveCode(newCode);
    if (fileId) {
      setProjectFiles(prev => prev.map(f => {
        if (f.id === fileId) {
          return { ...f, content: newCode };
        }
        return f;
      }));
    }
  };

  return (
    <div className="portal-container">
      {/* Sidebar Navigation */}
      <aside className="portal-sidebar glass-panel">
        <div className="sidebar-brand">
          <div className="brand-icon-wrapper">
            <Sparkles size={20} className="brand-logo-sparkle" />
          </div>
          <div className="brand-text">
            <h1>DevMind</h1>
            <span>Review Suite</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'sandbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('sandbox')}
          >
            <Code size={18} />
            <span>Code Sandbox</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'project' ? 'active' : ''}`}
            onClick={() => setActiveTab('project')}
          >
            <FolderOpen size={18} />
            <span>Project Reviewer</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={18} />
            <span>Complexity Analytics</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'exporter' ? 'active' : ''}`}
            onClick={() => setActiveTab('exporter')}
          >
            <Download size={18} />
            <span>Report Exporter</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'documind' ? 'active' : ''}`}
            onClick={() => setActiveTab('documind')}
          >
            <Brain size={18} />
            <span>DocuMind AI</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="user-profile-card">
              <div className="user-avatar">
                {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <span className="username" title={user.username}>{user.username}</span>
                <span className="user-email" title={user.email}>{user.email}</span>
              </div>
              <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="guest-card">
              <div className="guest-badge-pulsing"></div>
              <div className="guest-info">
                <span className="guest-title">Review Engine v1.2</span>
                <span className="guest-desc">Powered by Llama-3.3 70B</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="portal-main-content">
        <div className="portal-viewport">
          {activeTab === 'sandbox' && (
            <CodeReviewer 
              code={activeCode}
              setCode={(code) => handleCodeChange(code, null)}
              language={activeLanguage}
              setLanguage={setActiveLanguage}
              result={activeResult}
              setResult={setActiveResult}
            />
          )}

          {activeTab === 'project' && (
            <ProjectReviewer 
              projectFiles={projectFiles}
              setProjectFiles={setProjectFiles}
              activeCode={activeCode}
              activeLanguage={activeLanguage}
              activeResult={activeResult}
              onSelectFile={handleSelectFile}
              onUpdateFileReview={handleUpdateFileReview}
              onCodeChange={handleCodeChange}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard 
              code={activeCode}
              result={activeResult}
            />
          )}

          {activeTab === 'exporter' && (
            <ReportExporter 
              code={activeCode}
              language={activeLanguage}
              result={activeResult}
            />
          )}

          {activeTab === 'documind' && (
            <DocuMind 
              user={user}
              onAuthSuccess={handleAuthSuccess}
            />
          )}
        </div>
      </main>

      <style>{`
        .portal-container {
          display: flex;
          min-height: 100vh;
          width: 100vw;
          background-color: var(--bg-primary);
          overflow: hidden;
        }

        /* Sidebar Styling */
        .portal-sidebar {
          width: 260px;
          height: 100vh;
          border-radius: 0;
          border: none;
          border-right: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          background: rgba(13, 17, 28, 0.85);
          flex-shrink: 0;
          z-index: 10;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 36px;
          padding-left: 8px;
        }

        .brand-icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);
        }

        .brand-logo-sparkle {
          color: #fff;
        }

        .brand-text {
          text-align: left;
        }

        .brand-text h1 {
          font-size: 1.25rem;
          line-height: 1.2;
          font-weight: 700;
        }

        .brand-text span {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 500;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 0.95rem;
          cursor: pointer;
          transition: var(--transition-smooth);
          text-align: left;
        }

        .nav-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
        }

        .nav-item.active {
          color: #fff;
          background: var(--bg-tertiary);
          border-color: var(--border-light);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .nav-item.active svg {
          color: var(--color-primary);
          filter: drop-shadow(0 0 4px var(--color-primary));
        }
        
        .nav-item:nth-child(2).active svg {
          color: var(--color-secondary);
          filter: drop-shadow(0 0 4px var(--color-secondary));
        }

        .nav-item:nth-child(3).active svg {
          color: var(--color-success);
          filter: drop-shadow(0 0 4px var(--color-success));
        }

        .nav-item:nth-child(4).active svg {
          color: var(--color-warning);
          filter: drop-shadow(0 0 4px var(--color-warning));
        }

        /* Sidebar Footer */
        .sidebar-footer {
          margin-top: auto;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
        }

        .guest-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.01);
          border: 1px dashed var(--border-light);
          border-radius: 12px;
          padding: 12px;
          width: 100%;
          text-align: left;
        }

        .guest-badge-pulsing {
          width: 8px;
          height: 8px;
          background-color: var(--color-primary);
          border-radius: 50%;
          flex-shrink: 0;
          animation: pulse-guest 2s infinite ease-in-out;
          box-shadow: 0 0 8px var(--color-primary);
        }

        @keyframes pulse-guest {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        .guest-info {
          display: flex;
          flex-direction: column;
        }

        .guest-title {
          font-size: 0.8rem;
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-secondary);
        }

        .guest-desc {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* Main Content Viewport */
        .portal-main-content {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          padding: 40px;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, var(--bg-primary) 30%, #0d0f19 100%);
        }

        .portal-viewport {
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        @media (max-width: 1024px) {
          .portal-main-content {
            padding: 24px;
          }
        }

        @media (max-width: 768px) {
          .portal-container {
            flex-direction: column;
          }
          .portal-sidebar {
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid var(--border-light);
            padding: 16px;
          }
          .sidebar-brand {
            margin-bottom: 16px;
          }
          .sidebar-nav {
            flex-direction: row;
            margin-bottom: 12px;
            flex-wrap: wrap;
          }
          .portal-main-content {
            height: calc(100vh - 160px);
            padding: 16px;
          }
        }

        /* User Profile Card in Sidebar */
        .user-profile-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          padding: 12px;
          width: 100%;
          text-align: left;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          font-size: 1rem;
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
        }

        .user-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .username {
          font-size: 0.85rem;
          font-family: var(--font-heading);
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          font-size: 0.7rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-logout {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
        }

        .btn-logout:hover {
          color: var(--color-danger);
          background: rgba(239, 68, 68, 0.1);
        }

        /* Nav Item glow for DocuMind */
        .nav-item:nth-child(5).active svg {
          color: var(--color-primary);
          filter: drop-shadow(0 0 4px var(--color-primary));
        }
      `}</style>
    </div>
  );
}

export default App;
