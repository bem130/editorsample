// js-worker.js

const KEYWORDS = new Set(['class', 'extends', 'super', 'const', 'let', 'var', 'function', 'async', 'await', 'new', 'if', 'else', 'return', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'import', 'export', 'from', 'as', 'this']);
const BOOLEANS = new Set(['true', 'false']);
const OPERATORS = new Set(['+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '?', ':', '.']);
const PUNCTUATION = new Set(['{', '}', '(', ')', '[', ']', ',', ';']);

/**
 * テキストをスキャンし、トークン化、簡易解析、言語機能の提供を行うクラス。
 */
class JavaScriptAnalyzer {
    constructor(text) {
        this.text = text;
        this.tokens = [];
        this.diagnostics = [];
        this.declarations = new Map(); // { name: string, index: number }
        this.offset = 0;
        this.line = 1;
        this.column = 1;
    }

    /**
     * テキスト全体の解析を実行するメインメソッド。
     */
    analyze() {
        this.tokenize();
        this.parse();
        this.findDiagnostics();
    }

    // --- 1. Tokenizer (Scanner) ---

    /**
     * テキストをスキャンしてトークンの配列を生成する。
     */
    tokenize() {
        while (!this.isAtEnd()) {
            this.offset = this.skipWhitespace();
            if (this.isAtEnd()) break;

            const char = this.peek();

            if (this.isAlpha(char) || char === '_' || char === '$') {
                this.tokens.push(this.scanIdentifier());
            } else if (this.isDigit(char)) {
                this.tokens.push(this.scanNumber());
            } else if (char === '"' || char === "'" || char === '`') {
                this.tokens.push(this.scanString());
            } else if (char === '/' && this.peekNext() === '/') {
                this.tokens.push(this.scanSingleLineComment());
            } else if (char === '/' && this.peekNext() === '*') {
                this.tokens.push(this.scanMultiLineComment());
            } else if (char === '/' && this.isRegexStart()) {
                this.tokens.push(this.scanRegex());
            } else if (OPERATORS.has(char)) {
                this.tokens.push(this.scanOperator());
            } else if (PUNCTUATION.has(char)) {
                this.tokens.push(this.scanPunctuation());
            } else {
                this.advance(); // Skip unknown characters
            }
        }
    }

    createToken(type, start, end) {
        return { startIndex: start, endIndex: end, type };
    }

    scanIdentifier() {
        const start = this.offset;
        while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_' || this.peek() === '$')) {
            this.advance();
        }
        const text = this.text.substring(start, this.offset);
        let type = 'variable';
        if (KEYWORDS.has(text)) {
            type = 'keyword';
        } else if (BOOLEANS.has(text)) {
            type = 'boolean';
        } else if (this.peek() === '(') {
             // Look ahead to see if it's a function call
            const tempOffset = this.skipWhitespace(this.offset);
            if(this.text[tempOffset] === '(') {
                type = 'function';
            }
        }
        return this.createToken(type, start, this.offset);
    }

    scanNumber() {
        const start = this.offset;
        while (!this.isAtEnd() && this.isDigit(this.peek())) {
            this.advance();
        }
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance(); // Consume '.'
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                this.advance();
            }
        }
        return this.createToken('number', start, this.offset);
    }

    scanString() {
        const start = this.offset;
        const quote = this.advance();
        while (!this.isAtEnd() && this.peek() !== quote) {
            if (this.peek() === '\\' && !this.isAtEnd()) this.advance();
            this.advance();
        }
        if (!this.isAtEnd()) this.advance(); // Consume closing quote
        return this.createToken('string', start, this.offset);
    }
    
    scanSingleLineComment() {
        const start = this.offset;
        while(!this.isAtEnd() && this.peek() !== '\n') this.advance();
        return this.createToken('comment', start, this.offset);
    }

    scanMultiLineComment() {
        const start = this.offset;
        this.advance(); this.advance(); // consume */
        while(!this.isAtEnd() && (this.peek() !== '*' || this.peekNext() !== '/')) {
            this.advance();
        }
        if(!this.isAtEnd()) {
            this.advance(); this.advance(); // consume */
        }
        return this.createToken('comment', start, this.offset);
    }

    scanRegex() {
        const start = this.offset;
        this.advance(); // consume /
        while(!this.isAtEnd() && this.peek() !== '/') {
            if (this.peek() === '\\') this.advance();
            this.advance();
        }
        if(!this.isAtEnd()) this.advance(); // consume closing /
        while(!this.isAtEnd() && this.isAlpha(this.peek())) this.advance(); // flags
        return this.createToken('regex', start, this.offset);
    }

    scanOperator() {
        const start = this.offset;
        while (!this.isAtEnd() && OPERATORS.has(this.peek())) {
            this.advance();
        }
        // Handle properties separately (e.g. `console.log`)
        if (this.text[start] === '.' && this.offset > start + 1) {
            this.offset = start + 1; // Only consume the dot
            return this.createToken('operator', start, this.offset);
        }
        const text = this.text.substring(start, this.offset);
        if (text === '.') {
            const nextTokenStart = this.skipWhitespace();
            if (this.isAlpha(this.text[nextTokenStart])) {
                return this.createToken('property', start, this.offset);
            }
        }

        return this.createToken('operator', start, this.offset);
    }

    scanPunctuation() {
        const start = this.offset;
        this.advance();
        return this.createToken('punctuation', start, this.offset);
    }

    // --- 2. Parser & Analyzer ---
    
    /**
     * トークンを走査し、宣言や診断情報を収集する。
     */
    parse() {
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            const tokenText = this.text.substring(token.startIndex, token.endIndex);

            // Find declarations (const, let, var, function, class)
            if (token.type === 'keyword' && ['const', 'let', 'var', 'function', 'class'].includes(tokenText)) {
                const nextToken = this.findNextMeaningfulToken(i);
                if (nextToken && (nextToken.type === 'variable' || nextToken.type === 'function')) {
                    const name = this.text.substring(nextToken.startIndex, nextToken.endIndex);
                    if (!this.declarations.has(name)) {
                        this.declarations.set(name, { index: nextToken.startIndex });
                    }
                }
            }
        }
    }

    findDiagnostics() {
        // Example: Find 'console.log'
        const regex = /console\.log/g;
        let match;
        while((match = regex.exec(this.text))) {
            this.diagnostics.push({
                startIndex: match.index,
                endIndex: match.index + 11,
                message: 'デバッグ用のconsole.logが残っています。',
                severity: 'warning'
            });
        }
    }


    // --- 3. Language Features ---

    getHoverInfoAt(index) {
        const wordInfo = this.findWordAt(index);
        if (!wordInfo) return null;
        
        if (wordInfo.word === 'console') {
            return { content: 'Console API へのアクセスを提供します。' };
        }
        if (wordInfo.word === 'greet' && this.declarations.has('greet')) {
            return { content: 'function greet(name: string): string\n\n指定された名前で挨拶を返します。' };
        }
        return null;
    }

    getDefinitionLocationAt(index) {
        const wordInfo = this.findWordAt(index);
        if (!wordInfo) return null;
        
        const declaration = this.declarations.get(wordInfo.word);
        if (declaration) {
            return { targetIndex: declaration.index };
        }
        return null;
    }

    getOccurrencesAt(index) {
        const wordInfo = this.findWordAt(index);
        if (!wordInfo || KEYWORDS.has(wordInfo.word)) return [];
        
        const occurrences = [];
        const wordRegex = new RegExp(`\\b${wordInfo.word}\\b`, 'g');
        let match;
        while ((match = wordRegex.exec(this.text))) {
            occurrences.push({
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
        return occurrences;
    }

    getNextWordBoundary(index, direction) {
        const isSpace = (char) => /\s/.test(char);
        let targetIndex;

        if (direction === 'right') {
            let i = index;
            const len = this.text.length;
            if (i >= len) return len;
            
            while (i < len && !isSpace(this.text[i])) i++;
            while (i < len && isSpace(this.text[i])) i++;
            targetIndex = i;
        } else { // 'left'
            let i = index;
            if (i <= 0) return 0;
            
            i--;
            while (i >= 0 && isSpace(this.text[i])) i--;
            while (i >= 0 && !isSpace(this.text[i])) i--;
            targetIndex = i + 1;
        }
        return targetIndex;
    }

    // --- 4. Helpers ---

    isAtEnd(offset = this.offset) { return offset >= this.text.length; }
    peek(offset = this.offset) { return this.isAtEnd(offset) ? '\0' : this.text.charAt(offset); }
    peekNext(offset = this.offset) { return this.isAtEnd(offset + 1) ? '\0' : this.text.charAt(offset + 1); }
    advance() { this.offset++; return this.text.charAt(this.offset - 1); }
    isAlpha(char) { return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'); }
    isDigit(char) { return char >= '0' && char <= '9'; }
    isAlphaNumeric(char) { return this.isAlpha(char) || this.isDigit(char); }

    skipWhitespace(offset = this.offset) {
        while (offset < this.text.length) {
            const char = this.peek(offset);
            if (char === ' ' || char === '\r' || char === '\t' || char === '\n') {
                offset++;
            } else {
                break;
            }
        }
        return offset;
    }

    findNextMeaningfulToken(currentIndex) {
        for (let i = currentIndex + 1; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            if (token.type !== 'comment') {
                return token;
            }
        }
        return null;
    }
    
    findWordAt(index) {
        const wordRegex = /[\w$]+/g;
        let match;
        while ((match = wordRegex.exec(this.text))) {
            if (index >= match.index && index <= match.index + match[0].length) {
                return { word: match[0], startIndex: match.index, endIndex: match.index + match[0].length };
            }
        }
        return null;
    }
    
    isRegexStart() {
        let prevToken = null;
        if(this.tokens.length > 0) {
            prevToken = this.tokens[this.tokens.length - 1];
        }
        if (!prevToken) return true;
        const prevText = this.text.substring(prevToken.startIndex, prevToken.endIndex);
        return prevToken.type === 'operator' || prevToken.type === 'punctuation' && !['++', '--', ')', ']'].includes(prevText);
    }
}

// --- Worker Communication ---

let analyzer;

self.onmessage = (event) => {
    const { type, payload, requestId } = event.data;

    switch (type) {
        case 'updateText':
            analyzer = new JavaScriptAnalyzer(payload);
            analyzer.analyze();
            self.postMessage({
                type: 'update',
                payload: {
                    tokens: analyzer.tokens,
                    diagnostics: analyzer.diagnostics,
                    config: { highlightWhitespace: true, highlightIndent: true }
                }
            });
            break;
        
        case 'getHoverInfo':
            if (!analyzer) return;
            const hoverInfo = analyzer.getHoverInfoAt(payload.index);
            self.postMessage({ type: 'getHoverInfo', payload: hoverInfo, requestId });
            break;

        case 'getDefinitionLocation':
            if (!analyzer) return;
            const location = analyzer.getDefinitionLocationAt(payload.index);
            self.postMessage({ type: 'getDefinitionLocation', payload: location, requestId });
            break;
        
        case 'getOccurrences':
            if (!analyzer) return;
            const occurrences = analyzer.getOccurrencesAt(payload.index);
            self.postMessage({ type: 'getOccurrences', payload: occurrences, requestId });
            break;
        
        case 'getNextWordBoundary':
            if (!analyzer) return;
            const targetIndex = analyzer.getNextWordBoundary(payload.index, payload.direction);
            self.postMessage({ type: 'getNextWordBoundary', payload: { targetIndex }, requestId });
            break;
    }
};