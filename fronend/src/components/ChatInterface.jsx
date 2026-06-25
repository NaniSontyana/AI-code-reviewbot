import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { queryDocument, getChatHistory } from '../services/api';
import { ArrowLeft, Send, Loader2, Sparkles, HelpCircle, FileText, ChevronDown, ChevronUp, Check, Trash2, AlertCircle } from 'lucide-react';

function ChatInterface({ doc, onBack }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [openCitationIdx, setOpenCitationIdx] = useState(null); // ID of message with open citation

  const chatEndRef = useRef(null);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await getChatHistory(doc.id);
      if (data.success) {
        setMessages(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [doc.id]);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!question.trim() || sending) return;

    const userMsgText = question.trim();
    setQuestion('');
    setSending(true);
    setError('');

    // Optimistically add user's question to the UI
    const optimisticUserMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: userMsgText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticUserMsg]);

    try {
      const data = await queryDocument(doc.id, userMsgText);
      if (data.success) {
        // Add assistant response to the UI
        setMessages(prev => [...prev, data.message]);
      } else {
        setError(data.message || 'Failed to get answer.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error communicating with gateway. Please check if the ML microservice and backend are running.');
    } finally {
      setSending(false);
    }
  };

  const toggleCitation = (msgId) => {
    setOpenCitationIdx(openCitationIdx === msgId ? null : msgId);
  };

  return (
    <div className="chat-interface-workspace animate-fade-in">
      {/* Top Title Bar */}
      <div className="chat-header-bar glass-panel">
        <button className="btn-back" onClick={onBack} title="Back to documents">
          <ArrowLeft size={18} />
          <span>Documents</span>
        </button>

        <div className="chat-doc-title">
          <FileText size={18} className="text-secondary-icon" />
          <h3 title={doc.filename}>{doc.filename}</h3>
        </div>

        <div className="chat-header-badge">
          <span className="badge badge-success">Grounded Mode</span>
        </div>
      </div>

      {/* Main Workspace Split Pane */}
      <div className="chat-split-layout">
        {/* Left Pane - Document Specs & Help */}
        <div className="chat-left-pane glass-panel">
          <div className="pane-section">
            <h4>Document Specs</h4>
            <div className="spec-table">
              <div className="spec-row">
                <span className="spec-lbl">Pages</span>
                <span className="spec-val font-mono">{doc.page_count}</span>
              </div>
              <div className="spec-row">
                <span className="spec-lbl">Vector Chunks</span>
                <span className="spec-val font-mono">{doc.chunk_count}</span>
              </div>
              <div className="spec-row">
                <span className="spec-lbl">Embedding Dim</span>
                <span className="spec-val font-mono">384</span>
              </div>
            </div>
          </div>

          <div className="pane-section border-top">
            <h4>Conversation Help</h4>
            <ul className="help-list">
              <li>
                <HelpCircle size={14} className="help-icon" />
                <span>Ask questions directly based on document content.</span>
              </li>
              <li>
                <HelpCircle size={14} className="help-icon" />
                <span>Answers are strictly grounded in retrieved segments.</span>
              </li>
              <li>
                <HelpCircle size={14} className="help-icon" />
                <span>Expand citations to see source pages and snippets.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Pane - Chat Window */}
        <div className="chat-right-pane glass-panel">
          {/* Chat Scrollbox */}
          <div className="chat-messages-container">
            {historyLoading ? (
              <div className="chat-center-state">
                <Loader2 className="spinner text-primary-icon" size={32} />
                <span>Loading chat history...</span>
              </div>
            ) : messages.length > 0 ? (
              <div className="messages-list">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  // Parse citations if they are stringified in database
                  let citationsArray = [];
                  if (msg.citations) {
                    try {
                      citationsArray = typeof msg.citations === 'string' 
                        ? JSON.parse(msg.citations) 
                        : msg.citations;
                    } catch (e) {
                      console.error('Failed to parse citations:', e);
                    }
                  }

                  return (
                    <div 
                      key={msg.id} 
                      className={`message-wrapper ${isUser ? 'msg-user-wrapper' : 'msg-assistant-wrapper'}`}
                    >
                      <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
                        {/* Message content */}
                        <div className="message-text">
                          {isUser ? (
                            <p>{msg.content}</p>
                          ) : (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          )}
                        </div>

                        {/* Citation button */}
                        {!isUser && citationsArray && citationsArray.length > 0 && (
                          <div className="message-citations-control">
                            <button 
                              className="btn-toggle-citations"
                              onClick={() => toggleCitation(msg.id)}
                            >
                              <span>Sources & Citations ({citationsArray.length})</span>
                              {openCitationIdx === msg.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            {openCitationIdx === msg.id && (
                              <div className="citations-dropdown animate-fade-in">
                                {citationsArray.map((cite, cIdx) => (
                                  <div key={cIdx} className="citation-segment">
                                    <div className="citation-seg-header">
                                      <span className="badge badge-secondary">Page {cite.page}</span>
                                      <span className="citation-score">
                                        {Math.round(cite.score * 100)}% Match
                                      </span>
                                    </div>
                                    <p className="citation-snippet">
                                      "{cite.text || cite.chunk_text}"
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chat-center-state">
                <Sparkles size={36} className="text-secondary-icon pulse-brain" />
                <h4>Secure Grounded Session Started</h4>
                <p>Submit a question, and the model will perform semantic search across the vector database of this document to retrieve context segments and formulate a grounded answer.</p>
              </div>
            )}
            
            {/* Sending indicator */}
            {sending && (
              <div className="message-wrapper msg-assistant-wrapper">
                <div className="bubble-assistant typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}

            {error && (
              <div className="chat-error-banner animate-fade-in">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form onSubmit={handleSend} className="chat-input-form border-top">
            <input 
              type="text" 
              className="form-input chat-input" 
              placeholder="Ask a question about this document..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={sending || historyLoading}
            />
            <button 
              type="submit" 
              className="btn-primary btn-send-chat" 
              disabled={!question.trim() || sending || historyLoading}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .chat-interface-workspace {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: calc(100vh - 120px);
          min-height: 550px;
        }

        /* Top Header Bar */
        .chat-header-bar {
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(18, 22, 36, 0.8);
        }

        .btn-back {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 0.9rem;
          transition: var(--transition-smooth);
          padding: 4px 8px;
          border-radius: 6px;
        }

        .btn-back:hover {
          color: #fff;
          background: rgba(255,255,255,0.05);
        }

        .chat-doc-title {
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 50%;
          overflow: hidden;
        }

        .chat-doc-title h3 {
          font-size: 1.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Layout Split Pane */
        .chat-split-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          flex: 1;
          height: calc(100% - 68px);
        }

        @media (max-width: 768px) {
          .chat-split-layout {
            grid-template-columns: 1fr;
          }
          .chat-left-pane {
            display: none;
          }
        }

        .chat-left-pane {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: rgba(18, 22, 36, 0.5);
          text-align: left;
        }

        .pane-section h4 {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .spec-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .spec-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .spec-lbl {
          color: var(--text-muted);
        }

        .spec-val {
          color: var(--text-primary);
          font-weight: 500;
        }

        .border-top {
          border-top: 1px solid var(--border-light);
          padding-top: 20px;
        }

        .help-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .help-list li {
          display: flex;
          gap: 8px;
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        .help-icon {
          color: var(--color-secondary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Right Chat Window */
        .chat-right-pane {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: rgba(18, 22, 36, 0.7);
          overflow: hidden;
          height: 100%;
        }

        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .chat-center-state {
          margin: auto;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 20px;
        }

        .chat-center-state h4 {
          font-size: 1.15rem;
        }

        .chat-center-state p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .message-wrapper {
          display: flex;
          width: 100%;
        }

        .msg-user-wrapper {
          justify-content: flex-end;
        }

        .msg-assistant-wrapper {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 80%;
          padding: 14px 18px;
          border-radius: 14px;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .bubble-user {
          background: linear-gradient(135deg, #6d28d9, var(--color-primary));
          color: #fff;
          border-bottom-right-radius: 2px;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.15);
        }

        .bubble-assistant {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          border-bottom-left-radius: 2px;
          box-shadow: var(--glass-shadow);
        }

        /* React Markdown styles */
        .message-text p {
          color: inherit;
          margin-bottom: 8px;
        }
        .message-text p:last-child {
          margin-bottom: 0;
        }
        .message-text ul, .message-text ol {
          margin-left: 20px;
          margin-bottom: 8px;
        }
        .message-text li {
          margin-bottom: 4px;
        }

        /* Citations Panel */
        .message-citations-control {
          margin-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 8px;
        }

        .btn-toggle-citations {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--color-secondary);
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 0.8rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-toggle-citations:hover {
          color: #22d3ee;
        }

        .citations-dropdown {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(10, 12, 20, 0.6);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 10px;
          max-height: 180px;
          overflow-y: auto;
        }

        .citation-segment {
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 8px;
        }

        .citation-segment:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .citation-seg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .citation-score {
          font-size: 0.75rem;
          font-family: var(--font-mono);
          color: var(--color-secondary);
        }

        .citation-snippet {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-secondary);
          font-style: italic;
        }

        /* Bottom Form */
        .chat-input-form {
          padding: 16px 20px;
          display: flex;
          gap: 12px;
          background: rgba(13, 17, 28, 0.8);
        }

        .chat-input {
          flex: 1;
        }

        .btn-send-chat {
          padding: 12px 20px;
          background: linear-gradient(135deg, var(--color-secondary), #0891b2);
          box-shadow: 0 4px 14px rgba(6, 182, 212, 0.25);
        }

        .btn-send-chat:hover {
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.35);
        }

        .chat-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid var(--color-danger-border);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-top: 10px;
          text-align: left;
        }

        .text-danger { color: var(--color-danger); }
        .text-secondary-icon { color: var(--color-secondary); }
        .text-primary-icon { color: var(--color-primary); }
        .pulse-brain {
          animation: pulse-brain-state 2s infinite ease-in-out;
        }

        @keyframes pulse-brain-state {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }

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

export default ChatInterface;
