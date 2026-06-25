import { useState } from 'react';
import Auth from './Auth';
import DocList from './DocList';
import ChatInterface from './ChatInterface';

function DocuMind({ user, onAuthSuccess }) {
  const [selectedDoc, setSelectedDoc] = useState(null);

  // If user is not logged in, show Auth component
  if (!user) {
    return (
      <div className="documind-auth-wrapper">
        <div className="documind-intro">
          <h2>DocuMind AI Workspace</h2>
          <p>An intelligent PDF RAG companion. Upload textbooks, reports, or research papers and have a grounded conversation where every answer is backed by direct citations.</p>
        </div>
        <Auth onAuthSuccess={onAuthSuccess} />
        
        <style>{`
          .documind-auth-wrapper {
            max-width: 600px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .documind-intro {
            text-align: center;
            margin-top: 20px;
          }

          .documind-intro h2 {
            font-size: 1.8rem;
            margin-bottom: 8px;
          }

          .documind-intro p {
            font-size: 1rem;
            color: var(--text-secondary);
            line-height: 1.5;
          }
        `}</style>
      </div>
    );
  }

  // If user is logged in, show either the document list or the active chat session
  return (
    <div className="documind-workspace">
      {selectedDoc ? (
        <ChatInterface 
          doc={selectedDoc} 
          onBack={() => setSelectedDoc(null)} 
        />
      ) : (
        <DocList 
          onSelectDocument={(doc) => setSelectedDoc(doc)} 
        />
      )}
      
      <style>{`
        .documind-workspace {
          width: 100%;
        }
      `}</style>
    </div>
  );
}

export default DocuMind;
