class MarkdownLanguageProvider extends BaseLanguageProvider {
    constructor() {
        super('md-worker.js'); // 対応するWorkerのパスを指定
    }
}