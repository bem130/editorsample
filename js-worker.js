// js-worker.js
let textContent = '';
let tokens = [];
let diagnostics = [];

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

function tokenize(regex, type, tokensArray, group = 0) {
    let match;
    while (match = regex.exec(textContent)) {
        const startIndex = match.index;
        tokensArray.push({
            startIndex: startIndex,
            endIndex: startIndex + match[group].length,
            type
        });
    }
}

function analyze() {
    const newTokens = [];
    const tokenDefinitions = [
        { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
        { type: 'string', regex: /(`([^`])*`|'([^'])*'|"([^"])*")/g },
        { type: 'keyword', regex: /\b(class|extends|super|const|let|var|function|async|await|new|if|else|return|for|while|do|switch|case|default|break|continue|try|catch|finally|import|export|from|as|this)\b/g },
        { type: 'boolean', regex: /\b(true|false)\b/g },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
        { type: 'regex', regex: /\/(?![*+?])(?:[^\r\n[/]|\\[.])*\/[gimsuy]*/g },
        { type: 'function', regex: /(\w+)\s*(?=\()/g, group: 1 },
        { type: 'property', regex: /\.([a-zA-Z0-9_$]+)/g, group: 0 },
        { type: 'operator', regex: /[+\-*/%<>=!&|?:]+/g },
        { type: 'punctuation', regex: /[{}()[\].,;]/g }
    ];

    tokenDefinitions.forEach(({ type, regex, group }) => {
        tokenize(regex, type, newTokens, group);
    });
    
    newTokens.sort((a, b) => a.startIndex - b.startIndex);
    
    const filteredTokens = [];
    let lastEndIndex = -1;
    for (const token of newTokens) {
        if (token.startIndex >= lastEndIndex) {
            filteredTokens.push(token);
            lastEndIndex = token.endIndex;
        }
    }

    const newDiagnostics = [];
    let match;
    const consoleLogRegex = /console\.log/g;
    while(match = consoleLogRegex.exec(textContent)) {
        newDiagnostics.push({
            startIndex: match.index,
            endIndex: match.index + 11,
            message: 'デバッグ用のconsole.logが残っています。',
            severity: 'warning'
        });
    }

    tokens = filteredTokens;
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
            if (wordInfo) {
                if(wordInfo.word === 'console'){
                    hoverContent = 'Console API へのアクセスを提供します。';
                } else if(wordInfo.word === 'greet') {
                    hoverContent = 'function greet(name: string): string\n\n指定された名前で挨拶を返します。';
                }
            }
            self.postMessage({ type: 'getHoverInfo', payload: { content: hoverContent }, requestId });
            break;

        case 'getDefinitionLocation':
            let target = null;
            const wordAtCursor = findWordAt(textContent, payload.index);
            if (wordAtCursor) {
                const definitionRegex = new RegExp(`(?:function|const|let|var|class)\\s+(${wordAtCursor.word})\\b`);
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