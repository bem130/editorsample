const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
global.requestAnimationFrame = () => 0;

class FakeCanvasEditor {
    constructor(canvas, textarea, domElements, options) {
        this.canvas = canvas;
        this.textarea = textarea;
        this.domElements = domElements;
        this.options = options;
        this.registered = [];
        this.text = '';
        this.activeLanguage = null;
    }

    registerLanguageProvider(id, provider) {
        this.registered.push({ id, provider });
        this.activeLanguage = id;
    }

    setText(text) {
        this.text = text;
    }
}

class FakeBaseLanguageProvider {
    constructor(workerPath) {
        this.workerPath = workerPath;
    }
}

class FakeLanguageProvider {}

global.CanvasEditor = FakeCanvasEditor;
global.BaseLanguageProvider = FakeBaseLanguageProvider;
global.JavaScriptLanguageProvider = FakeLanguageProvider;
global.MarkdownLanguageProvider = FakeLanguageProvider;

const librarySource = fs.readFileSync('src/library/canvas-editor-lib.js', 'utf8');
vm.runInThisContext(librarySource);

const canvasStub = {};
const textareaStub = {};
const domElements = {
    popup: {},
    problemsPanel: {},
    completionList: {}
};

const languageProviders = {
    javascript: { id: 'js-provider' }
};

const { editor, setLanguage, registerLanguage, getLanguageProvider } = global.CanvasEditorLibrary.createCanvasEditor({
    canvas: canvasStub,
    textarea: textareaStub,
    popup: domElements.popup,
    problemsPanel: domElements.problemsPanel,
    completionList: domElements.completionList,
    languageProviders,
    initialLanguage: 'javascript',
    initialText: 'hello world',
    editorOptions: { autoRender: false, bindEvents: false }
});

// 初期化時に言語とテキストが設定されること
assert.strictEqual(editor.text, 'hello world');
assert.deepStrictEqual(editor.registered, [{ id: 'javascript', provider: languageProviders.javascript }]);

// 言語の動的追加と切り替えができること
const customProvider = { id: 'custom-dsl' };
registerLanguage('dsl', customProvider);
assert.strictEqual(getLanguageProvider('dsl'), customProvider);
setLanguage('dsl');
assert.strictEqual(editor.activeLanguage, 'dsl');

// カスタムWorker用プロバイダファクトリ
const workerProvider = global.CanvasEditorLibrary.createWorkerLanguageProvider('/path/to/worker.js');
assert.ok(workerProvider instanceof FakeBaseLanguageProvider);
assert.strictEqual(workerProvider.workerPath, '/path/to/worker.js');

console.log('All library tests passed.');
