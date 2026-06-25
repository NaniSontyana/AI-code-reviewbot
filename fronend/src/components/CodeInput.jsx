function CodeInput({ code, setCode }) {
    return (
        <textarea
            rows="15"
            cols="80"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here..."
        />
    );
}

export default CodeInput;