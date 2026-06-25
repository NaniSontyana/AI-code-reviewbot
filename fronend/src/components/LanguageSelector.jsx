function LanguageSelector({ language, setLanguage }) {
  return (
    <div className="language-selector-wrapper">
      <select
        className="language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="javascript">JavaScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
      </select>
      
      <style>{`
        .language-selector-wrapper {
          position: relative;
          display: inline-block;
        }

        .language-select {
          appearance: none;
          -webkit-appearance: none;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          padding: 10px 36px 10px 16px;
          color: #fff;
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: var(--transition-smooth);
          outline: none;
        }

        .language-select:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--border-hover);
        }

        .language-select:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        /* Custom down arrow icon */
        .language-selector-wrapper::after {
          content: '';
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-25%);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid var(--text-secondary);
          pointer-events: none;
          transition: var(--transition-smooth);
        }

        .language-selector-wrapper:hover::after {
          border-top-color: #fff;
        }
      `}</style>
    </div>
  );
}

export default LanguageSelector;