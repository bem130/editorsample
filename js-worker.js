// js-worker.js

const KEYWORDS = new Set(['class', 'extends', 'super', 'const', 'let', 'var', 'function', 'async', 'await', 'new', 'if', 'else', 'return', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'import', 'export', 'from', 'as', 'this']);
const BOOLEANS = new Set(['true', 'false']);
const OPERATORS = new Set(['+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '?', ':', '.']);
const PUNCTUATION = new Set(['{', '}', '(', ')', '[', ']', ',', ';']);
const SNIPPETS = [
    { label: 'log', type: 'snippet', insertText: 'console.log($0);', detail: 'console.log(...)' },
    { label: 'for', type: 'snippet', insertText: 'for (let i = 0; i < 10; i++) {\n    $0\n}', detail: 'for loop' },
    { label: 'if', type: 'snippet', insertText: 'if ($0) {\n    \n}', detail: 'if statement' },
    { label: 'ifelse', type: 'snippet', insertText: 'if ($0) {\n    \n} else {\n    \n}', detail: 'if/else statement' },
    { label: 'func', type: 'snippet', insertText: 'function name($0) {\n    \n}', detail: 'function declaration' },
];

class JavaScriptAnalyzer {
    constructor(text) {
        this.text = text;
        this.tokens = [];
        this.diagnostics = [];
        this.declarations = new Map();
        this.offset = 0;
    }

    analyze() {
        this.tokenize();
        this.parse();
        this.findDiagnostics();
    }

    tokenize() {
        while (!this.isAtEnd()) {
            this.offset = this.skipWhitespace();
            if (this.isAtEnd()) break;
            const char = this.peek();
            if (this.isAlpha(char) || char === '_' || char === '$') this.tokens.push(this.scanIdentifier());
            else if (this.isDigit(char)) this.tokens.push(this.scanNumber());
            else if (char === '"' || char === "'" || char === '`') this.tokens.push(this.scanString());
            else if (char === '/' && this.peekNext() === '/') this.tokens.push(this.scanSingleLineComment());
            else if (char === '/' && this.peekNext() === '*') this.tokens.push(this.scanMultiLineComment());
            else if (char === '/' && this.isRegexStart()) this.tokens.push(this.scanRegex());
            else if (OPERATORS.has(char)) this.tokens.push(this.scanOperator());
            else if (PUNCTUATION.has(char)) this.tokens.push(this.scanPunctuation());
            else this.advance();
        }
    }
    createToken(type, start, end) { return { startIndex: start, endIndex: end, type }; }
    scanIdentifier() { const start = this.offset; while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_' || this.peek() === '$')) this.advance(); const text = this.text.substring(start, this.offset); let type = 'variable'; if (KEYWORDS.has(text)) type = 'keyword'; else if (BOOLEANS.has(text)) type = 'boolean'; else { const tempOffset = this.skipWhitespace(this.offset); if(this.text[tempOffset] === '(') type = 'function'; } return this.createToken(type, start, this.offset); }
    scanNumber() { const start = this.offset; while (!this.isAtEnd() && this.isDigit(this.peek())) this.advance(); if (this.peek() === '.' && this.isDigit(this.peekNext())) { this.advance(); while (!this.isAtEnd() && this.isDigit(this.peek())) this.advance(); } return this.createToken('number', start, this.offset); }
    scanString() { const start = this.offset; const quote = this.advance(); while (!this.isAtEnd() && this.peek() !== quote) { if (this.peek() === '\\' && !this.isAtEnd()) this.advance(); this.advance(); } if (!this.isAtEnd()) this.advance(); return this.createToken('string', start, this.offset); }
    scanSingleLineComment() { const start = this.offset; while(!this.isAtEnd() && this.peek() !== '\n') this.advance(); return this.createToken('comment', start, this.offset); }
    scanMultiLineComment() { const start = this.offset; this.advance(); this.advance(); while(!this.isAtEnd() && (this.peek() !== '*' || this.peekNext() !== '/')) this.advance(); if(!this.isAtEnd()) { this.advance(); this.advance(); } return this.createToken('comment', start, this.offset); }
    scanRegex() { const start = this.offset; this.advance(); while(!this.isAtEnd() && this.peek() !== '/') { if (this.peek() === '\\') this.advance(); this.advance(); } if(!this.isAtEnd()) this.advance(); while(!this.isAtEnd() && this.isAlpha(this.peek())) this.advance(); return this.createToken('regex', start, this.offset); }
    scanOperator() { const start = this.offset; while (!this.isAtEnd() && OPERATORS.has(this.peek())) this.advance(); if (this.text[start] === '.' && this.offset > start + 1) { this.offset = start + 1; return this.createToken('operator', start, this.offset); } return this.createToken('operator', start, this.offset); }
    scanPunctuation() { const start = this.offset; this.advance(); return this.createToken('punctuation', start, this.offset); }

    parse() {
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            const tokenText = this.text.substring(token.startIndex, token.endIndex);
            if (token.type === 'keyword' && ['const', 'let', 'var', 'function', 'class'].includes(tokenText)) {
                const nextToken = this.findNextMeaningfulToken(i);
                if (nextToken && (nextToken.type === 'variable' || nextToken.type === 'function')) {
                    const name = this.text.substring(nextToken.startIndex, nextToken.endIndex);
                    if (!this.declarations.has(name)) this.declarations.set(name, { index: nextToken.startIndex, type: tokenText });
                }
            }
        }
    }
    findDiagnostics() { const regex = /console\.log/g; let match; while((match = regex.exec(this.text))) { this.diagnostics.push({ startIndex: match.index, endIndex: match.index + 11, message: 'デバッグ用のconsole.logが残っています。', severity: 'warning' }); } }

    getHoverInfoAt(index) { const wordInfo = this.findWordAt(index); if (!wordInfo) return null; if (wordInfo.word === 'console') return { content: 'Console API へのアクセスを提供します。' }; if (wordInfo.word === 'greet' && this.declarations.has('greet')) return { content: 'function greet(name: string): string\n\n指定された名前で挨拶を返します。' }; return null; }
    getDefinitionLocationAt(index) { const wordInfo = this.findWordAt(index); if (!wordInfo) return null; const declaration = this.declarations.get(wordInfo.word); if (declaration) return { targetIndex: declaration.index }; return null; }
    getOccurrencesAt(index) { const wordInfo = this.findWordAt(index); if (!wordInfo || KEYWORDS.has(wordInfo.word)) return []; const occurrences = []; const wordRegex = new RegExp(`\\b${wordInfo.word}\\b`, 'g'); let match; while ((match = wordRegex.exec(this.text))) { occurrences.push({ startIndex: match.index, endIndex: match.index + match[0].length }); } return occurrences; }
    getNextWordBoundary(index, direction) { const isSpace = (char) => /\s/.test(char); let i = index; if (direction === 'right') { const len = this.text.length; if (i >= len) return len; while (i < len && !isSpace(this.text[i])) i++; while (i < len && isSpace(this.text[i])) i++; return i; } else { if (i <= 0) return 0; i--; while (i >= 0 && isSpace(this.text[i])) i--; while (i >= 0 && !isSpace(this.text[i])) i--; return i + 1; } }
    
    getCompletions(index) {
        let suggestions = [];
        const prefixInfo = this.getPrefixAt(index);
        const prefix = prefixInfo ? prefixInfo.prefix.toLowerCase() : '';

        KEYWORDS.forEach(kw => suggestions.push({ label: kw, type: 'keyword' }));
        this.declarations.forEach((val, key) => suggestions.push({ label: key, type: val.type, detail: val.type }));
        SNIPPETS.forEach(snip => suggestions.push(snip));
        
        if (!prefix) return suggestions;

        return suggestions.filter(s => {
            const label = s.label.toLowerCase();
            if (s.type === 'snippet') {
                const text = (s.insertText || '').toLowerCase();
                return label.startsWith(prefix) || text.startsWith(prefix);
            }
            return label.startsWith(prefix);
        });
    }
    
    isAtEnd(offset = this.offset) { return offset >= this.text.length; }
    peek(offset = this.offset) { return this.isAtEnd(offset) ? '\0' : this.text.charAt(offset); }
    peekNext(offset = this.offset) { return this.isAtEnd(offset + 1) ? '\0' : this.text.charAt(offset + 1); }
    advance() { this.offset++; return this.text.charAt(this.offset - 1); }
    isAlpha(char) { return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'); }
    isDigit(char) { return char >= '0' && char <= '9'; }
    isAlphaNumeric(char) { return this.isAlpha(char) || this.isDigit(char); }
    skipWhitespace(offset = this.offset) { while (offset < this.text.length && /\s/.test(this.peek(offset))) offset++; return offset; }
    findNextMeaningfulToken(currentIndex) { for (let i = currentIndex + 1; i < this.tokens.length; i++) if (this.tokens[i].type !== 'comment') return this.tokens[i]; return null; }
    findWordAt(index) { const wordRegex = /[\w$]+/g; let match; while ((match = wordRegex.exec(this.text))) { if (index >= match.index && index <= match.index + match[0].length) return { word: match[0], startIndex: match.index, endIndex: match.index + match[0].length }; } return null; }
    isRegexStart() { let prevToken = this.tokens.length > 0 ? this.tokens[this.tokens.length - 1] : null; if (!prevToken) return true; const prevText = this.text.substring(prevToken.startIndex, prevToken.endIndex); return prevToken.type === 'operator' || (prevToken.type === 'punctuation' && !['++', '--', ')', ']'].includes(prevText)); }
    getPrefixAt(index) { let start = index; while (start > 0 && /[\w$]/.test(this.text[start - 1])) start--; if (start === index) return null; return { prefix: this.text.substring(start, index), startIndex: start, endIndex: index }; }
}

let analyzer;
self.onmessage = (event) => {
    const { type, payload, requestId } = event.data;
    switch (type) {
        case 'updateText': analyzer = new JavaScriptAnalyzer(payload); analyzer.analyze(); self.postMessage({ type: 'update', payload: { tokens: analyzer.tokens, diagnostics: analyzer.diagnostics, config: { highlightWhitespace: true, highlightIndent: true } } }); break;
        case 'getHoverInfo': if (analyzer) self.postMessage({ type, payload: analyzer.getHoverInfoAt(payload.index), requestId }); break;
        case 'getDefinitionLocation': if (analyzer) self.postMessage({ type, payload: analyzer.getDefinitionLocationAt(payload.index), requestId }); break;
        case 'getOccurrences': if (analyzer) self.postMessage({ type, payload: analyzer.getOccurrencesAt(payload.index), requestId }); break;
        case 'getNextWordBoundary': if (analyzer) self.postMessage({ type, payload: { targetIndex: analyzer.getNextWordBoundary(payload.index, payload.direction) }, requestId }); break;
        case 'getCompletions': if(analyzer) self.postMessage({ type, payload: analyzer.getCompletions(payload.index), requestId}); break;
    }
};