/**
 * 言語機能プロバイダの基底クラス。
 * Web Workerとの通信を抽象化する。
 */
class BaseLanguageProvider {
    /**
     * @param {string} workerPath - Web Workerスクリプトへのパス
     */
    constructor(workerPath) {
        this.worker = new Worker(workerPath);
        this.callbacks = new Map();
        this.updateCallback = () => {};

        this.worker.onmessage = (event) => {
            const { type, payload, requestId } = event.data;
            if (type === 'update') {
                this.updateCallback(payload);
            } else if (this.callbacks.has(requestId)) {
                const callback = this.callbacks.get(requestId);
                callback(payload);
                this.callbacks.delete(requestId);
            }
        };
    }

    /**
     * Workerにメッセージを送信し、対応する応答をPromiseとして待機する。
     * @param {string} type - メッセージのタイプ
     * @param {*} [payload] - 送信するデータ
     * @returns {Promise<any>}
     */
    _postMessageAndWaitForResult(type, payload) {
        return new Promise((resolve) => {
            const requestId = Date.now() + Math.random();
            this.callbacks.set(requestId, resolve);
            this.worker.postMessage({ type, payload, requestId });
        });
    }

    /**
     * 解析結果の更新を受け取るためのコールバックを登録する。
     * @param {function(object): void} callback 
     */
    onUpdate(callback) {
        this.updateCallback = callback;
    }

    /**
     * Workerに現在のテキスト内容を通知する。
     * @param {string} text 
     */
    updateText(text) {
        this.worker.postMessage({ type: 'updateText', payload: text });
    }

    getHoverInfo(index) {
        return this._postMessageAndWaitForResult('getHoverInfo', { index });
    }

    getDefinitionLocation(index) {
        return this._postMessageAndWaitForResult('getDefinitionLocation', { index });
    }
}