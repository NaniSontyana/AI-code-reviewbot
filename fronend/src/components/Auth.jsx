import { useState } from 'react';
import { loginUser, registerUser } from '../services/api';
import { KeyRound, Mail, User, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';

function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTabSwitch = (loginTab) => {
    setIsLogin(loginTab);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !username)) {
      setError('All fields are required.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const data = await loginUser(email, password);
        if (data.success) {
          onAuthSuccess(data.user);
        } else {
          setError(data.message || 'Login failed.');
        }
      } else {
        const data = await registerUser(username, email, password);
        if (data.success) {
          onAuthSuccess(data.user);
        } else {
          setError(data.message || 'Registration failed.');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Connection failed. Please verify the gateway server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        {/* Header Tab Switchers */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => handleTabSwitch(true)}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => handleTabSwitch(false)}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-header">
          <h3>{isLogin ? 'Welcome back to DocuMind' : 'Create your DocuMind Account'}</h3>
          <p>{isLogin ? 'Access your securely indexed PDFs and chat history.' : 'Start uploading and chatting with your documents.'}</p>
        </div>

        {error && (
          <div className="auth-error-banner animate-fade-in">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Username</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input 
                type="email" 
                className="form-input" 
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <KeyRound size={16} className="input-icon" />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
            <span>{loading ? (isLogin ? 'Signing In...' : 'Creating Account...') : (isLogin ? 'Sign In' : 'Sign Up')}</span>
          </button>
        </form>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 36px 32px;
          text-align: left;
          background: rgba(18, 22, 36, 0.75);
        }

        .auth-tabs {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 28px;
        }

        .auth-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          padding: 8px;
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 8px;
          transition: var(--transition-smooth);
        }

        .auth-tab-btn.active {
          background: var(--bg-tertiary);
          color: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .auth-header {
          margin-bottom: 24px;
        }

        .auth-header h3 {
          font-size: 1.4rem;
          margin-bottom: 6px;
        }

        .auth-header p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid var(--color-danger-border);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 20px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
          transition: var(--transition-smooth);
        }

        .form-input {
          padding-left: 42px;
        }

        .form-input:focus + .input-icon {
          color: var(--color-primary);
        }

        .auth-submit-btn {
          margin-top: 10px;
          width: 100%;
          padding: 12px;
          flex-direction: row-reverse;
          font-size: 1rem;
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

export default Auth;
