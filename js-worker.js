// js-worker.js
let textContent = '';
let tokens = [];
let diagnostics = [];

/**
 * テキストから特定の単語（識別子）をカーソル位置に基づいて抽出します。
 * @param {string} text - 全文
 * @param {number} index - カーソルの文字インデックス
 * @returns {{word: string, startIndex: number, endIndex: number} | null}
 */
function findWordAt(text, index) {
    const wordRegex = /[\w$]+/g;
    let match;
    while(match = wordRegex.exec(text)) {
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;
        if (index >= startIndex && index <= endIndex) {
            return { word: match[0], startIndex, endIndex };
        }
    }
    return null;
}

/**
 * テキストが更新されるたびに呼び出され、構文解析を実行する
 */
function analyze() {
    const newTokens = [];
    const keywords = /\b(function|const|let|var|if|else|return|async|await|new|class|extends|super)\b/g;
    const strings = /(`([^`])*`|'([^'])*'|"([^"])*")/g;
    const comments = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
    const functions = /(\w+)\s*(?=\()/g;
    const numbers = /\b\d+(\.\d+)?\b/g;

    let match;
    while(match = keywords.exec(textContent)) { newTokens.push({ startIndex: match.index, endIndex: match.index + match[0].length, type: 'keyword' }); }
    while(match = strings.exec(textContent)) { newTokens.push({ startIndex: match.index, endIndex: match.index + match[0].length, type: 'string' }); }
    while(match = comments.exec(textContent)) { newTokens.push({ startIndex: match.index, endIndex: match.index + match[0].length, type: 'comment' }); }
    while(match = functions.exec(textContent)) { if(!keywords.test(match[1])) newTokens.push({ startIndex: match.index, endIndex: match.index + match[1].length, type: 'function' }); }
    while(match = numbers.exec(textContent)) { newTokens.push({ startIndex: match.index, endIndex: match.index + match[0].length, type: 'number' }); }
    
    const newDiagnostics = [];
    const consoleLogRegex = /console\.log/g;
    while(match = consoleLogRegex.exec(textContent)) {
        newDiagnostics.push({
            startIndex: match.index,
            endIndex: match.index + 11,
            message: 'デバッグ用のconsole.logが残っています。',
            severity: 'warning'
        });
    }

    tokens = newTokens;
    diagnostics = newDiagnostics;

    self.postMessage({
        type: 'update',
        payload: {
            tokens: tokens,
            diagnostics: diagnostics,
            config: {
                highlightWhitespace: true,
                highlightIndent: true
            }
        }
    });
}


self.onmessage = (event) => {
    const { type, payload, requestId } = event.data;

    switch (type) {
        case 'updateText':
            textContent = payload;
            analyze();
            break;
        
        case 'getHoverInfo':
            let hoverContent = null;
            const wordInfo = findWordAt(textContent, payload.index);
            if (wordInfo && wordInfo.word === 'console') {
                hoverContent = 'Console API へのアクセスを提供します。';
            }
            self.postMessage({ type: 'getHoverInfo', payload: { content: hoverContent }, requestId });
            break;

        case 'getDefinitionLocation':
            let target = null;
            const wordAtCursor = findWordAt(textContent, payload.index);
            if (wordAtCursor) {
                const definitionRegex = new RegExp(`(?:function|const|let|var)\\s+(${wordAtCursor.word})\\b`);
                const match = definitionRegex.exec(textContent);
                if (match) {
                    const definitionIndex = match.index + match[0].indexOf(match[1]);
                    target = { targetIndex: definitionIndex };
                }
            }
            self.postMessage({ type: 'getDefinitionLocation', payload: target, requestId });
            break;
    }
};