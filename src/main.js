document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const canvas = document.getElementById('editor-canvas');
    const textarea = document.getElementById('hidden-input');
    const popup = document.getElementById('popup');
    const problemsPanel = document.querySelector('#problems-panel ul');
    const completionList = document.getElementById('completion-list');
    const langSelect = document.getElementById('language-select');
    const sampleSelect = document.getElementById('sample-select');

    // サンプルテキストデータ
    const sampleTexts = {
        javascript: {
            'Class & Methods': 'class MyClass extends BaseClass {\n    #privateField = 123;\n\n    constructor() {\n        console.log("Hello, World!");\n        const regex = /ab+c/i;\n        this.value = true;\n    }\n\n    greet(name) {\n        return `Hello, ${name}`;\n    }\n}\n\nconst instance = new MyClass();\ninstance.greet("Editor");',
            'Functions & Async': 'async function fetchData(url) {\n    try {\n        const response = await fetch(url);\n        if (!response.ok) {\n            throw new Error(`HTTP error! status: ${response.status}`);\n        }\n        return await response.json();\n    } catch (e) {\n        console.error("Fetch error:", e.message);\n        return null;\n    }\n}\n\nconst url = "https://api.example.com/data";\nfetchData(url).then(data => {\n    console.log(data);\n});',
        },
        markdown: {
            'Features Demo': '# Markdown Editor\n\nThis is a demo of a **Markdown** text editor built with `<canvas>`.\n\n## Features\n\n*   Syntax Highlighting\n*   *Italics* and **Bold** text\n*   Inline code like `const editor = new CanvasEditor()`\n*   Code blocks with language support:\n\n```javascript\nfunction greet() {\n    // This block is highlighted as a string\n    console.log("Hello from the canvas editor!");\n}\n```\n\n## Lists\n\n1.  Ordered List Item 1\n2.  Ordered List Item 2\n\n- Unordered List Item\n- Another item\n\nCheck out the source code on [GitHub](https://github.com)! (This is a dummy link)',
            'Simple Document': '## Chapter 1: The Beginning\n\nIt was a dark and stormy night. The wind howled, and the rain beat against the windowpanes.\n\nInside, a lone developer was hunched over a glowing screen, bringing a new creation to life.\n\n### A Spark of an Idea\n\nThe idea was simple: create a text editor that was both powerful and performant, using only the browser\'s native technologies. No frameworks, no heavy libraries. Just pure, unadulterated code.',
        }
    };

    // エディタと言語プロバイダのインスタンス化
    const jsProvider = new JavaScriptLanguageProvider();
    const mdProvider = new MarkdownLanguageProvider();
    const { editor, setLanguage } = CanvasEditorLibrary.createCanvasEditor({
        canvas,
        textarea,
        popup,
        problemsPanel,
        completionList,
        languageProviders: {
            javascript: jsProvider,
            markdown: mdProvider
        },
        initialLanguage: 'javascript'
    });

    // UIロジック
    function updateSampleOptions() {
        const lang = langSelect.value;
        const samples = sampleTexts[lang];
        sampleSelect.innerHTML = '';
        Object.keys(samples).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            sampleSelect.appendChild(option);
        });
    }

    function updateEditor() {
        const lang = langSelect.value;
        const sampleKey = sampleSelect.value;
        const text = sampleTexts[lang][sampleKey];

        if (lang === 'javascript') {
            setLanguage('javascript');
            problemsPanel.parentElement.style.display = 'flex';
        } else if (lang === 'markdown') {
            setLanguage('markdown');
            problemsPanel.parentElement.style.display = 'none'; // Markdownでは問題パネルを非表示
        }
        
        editor.setText(text);
    }

    // イベントリスナーの設定
    langSelect.addEventListener('change', () => {
        updateSampleOptions();
        updateEditor();
    });
    sampleSelect.addEventListener('change', updateEditor);

    // 初期化処理
    updateSampleOptions();
    updateEditor();
});