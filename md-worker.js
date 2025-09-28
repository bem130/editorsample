// md-worker.js

class MarkdownAnalyzer {
    constructor(text) {
        this.text = text;
        this.tokens = [];
        this.foldingRanges = [];
    }

    analyze() {
        this.tokenize();
        this.computeFoldingRanges();
    }

    createToken(type, start, end) {
        return { startIndex: start, endIndex: end, type };
    }

    tokenize() {
        this.tokens = [];
        const lines = this.text.split('\n');
        let offset = 0;
        let inCodeBlock = false;

        for (const line of lines) {
            const lineLength = line.length;

            if (inCodeBlock) {
                if (line.trim().startsWith('```')) {
                    this.tokens.push(this.createToken('code-block', offset, offset + lineLength));
                    inCodeBlock = false;
                } else {
                    // コードブロックの中身は、便宜上 'string' タイプとしてハイライトする
                    this.tokens.push(this.createToken('string', offset, offset + lineLength));
                }
            } else {
                let consumed = false;
                // コードブロック開始
                let match = line.match(/^```(\w*)/);
                if (match) {
                    this.tokens.push(this.createToken('code-block', offset, offset + lineLength));
                    inCodeBlock = true;
                    consumed = true;
                }
                // 見出し
                if (!consumed) {
                    match = line.match(/^(#+) /);
                    if (match) {
                        this.tokens.push(this.createToken('heading', offset, offset + lineLength));
                        consumed = true; // 行全体を消費
                    }
                }
                // リスト
                if (!consumed) {
                    match = line.match(/^(\s*)([-*+] |[0-9]+\.) /);
                    if (match) {
                        this.tokens.push(this.createToken('list', offset + match[1].length, offset + match[0].length - 1));
                    }
                }
                
                // インライン要素（複数適用される可能性がある）
                // より長くマッチするものを優先するために、正規表現を調整
                const inlinePatterns = [
                    { type: 'inline-code', regex: /`([^`]+?)`/g },
                    { type: 'bold', regex: /(\*\*|__)(.+?)\1/g },
                    { type: 'italic', regex: /(\*|_)(.+?)\1/g },
                    { type: 'link', regex: /\[(.+?)\]\((.+?)\)/g },
                ];

                for (const pattern of inlinePatterns) {
                    let inlineMatch;
                    while((inlineMatch = pattern.regex.exec(line))) {
                        const start = offset + inlineMatch.index;
                        const end = start + inlineMatch[0].length;
                        // 既にトークン化された範囲との重複を避ける（簡易的なチェック）
                        const isOverlapping = this.tokens.some(t => t.startIndex < end && t.endIndex > start);
                        if (!isOverlapping) {
                           this.tokens.push(this.createToken(pattern.type, start, end));
                        }
                    }
                }
            }
            offset += lineLength + 1; // +1 for the newline character
        }
    }

    computeFoldingRanges() {
        this.foldingRanges = [];
        const lines = this.text.split('\n');
        const headingStack = [];

        for(let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/^(#+) /);
            if (match) {
                const level = match[1].length;
                while(headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
                    const lastHeading = headingStack.pop();
                    if (i - 1 > lastHeading.line) {
                       this.foldingRanges.push({ startLine: lastHeading.line, endLine: i - 1, placeholder: '...' });
                    }
                }
                headingStack.push({ line: i, level: level });
            }
        }
        // ファイルの最後まで残っている見出しを処理
        while(headingStack.length > 0) {
            const lastHeading = headingStack.pop();
            if (lines.length - 1 > lastHeading.line) {
                this.foldingRanges.push({ startLine: lastHeading.line, endLine: lines.length - 1, placeholder: '...' });
            }
        }
        this.foldingRanges.sort((a,b) => a.startLine - b.startLine);
    }
}

let analyzer;

self.onmessage = (event) => {
    const { type, payload, requestId } = event.data;
    switch (type) {
        case 'updateText':
            analyzer = new MarkdownAnalyzer(payload);
            analyzer.analyze();
            self.postMessage({
                type: 'update',
                payload: {
                    tokens: analyzer.tokens,
                    diagnostics: [], // Markdownでは診断なし
                    foldingRanges: analyzer.foldingRanges,
                    config: { highlightWhitespace: false, highlightIndent: false }
                }
            });
            break;
        // Markdownでは以下の機能はサポートしないため、nullまたは空の配列を返す
        case 'getHoverInfo': 
        case 'getDefinitionLocation':
        case 'getBracketMatch':
            if (analyzer) self.postMessage({ type, payload: null, requestId });
            break;
        case 'getOccurrences':
        case 'getCompletions':
            if (analyzer) self.postMessage({ type, payload: [], requestId });
            break;
        // 以下の機能はデフォルトの動作にフォールバックさせるため、空の応答を返す
        case 'getIndentation':
        case 'toggleComment':
        case 'adjustIndentation':
        case 'getNextWordBoundary':
             if (analyzer) self.postMessage({ type, payload: null, requestId });
             break;
    }
};