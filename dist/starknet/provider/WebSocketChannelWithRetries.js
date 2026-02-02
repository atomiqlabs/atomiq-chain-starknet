"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketChannelWithRetries = void 0;
const starknet_1 = require("starknet");
/**
 * An impl of WebSocketChannel which override the default exponential backoff and makes it linear
 * Also adds connection timeouts and retries if the initial connection fails. Retries indefinitely!
 *
 * @category Providers
 */
class WebSocketChannelWithRetries extends starknet_1.WebSocketChannel {
    /**
     * Creates a new websocket channel, you can pass an additional `options.connectionTimeoutMs` param, which
     *  defines a connection timeout, after the timeout the connection is re-attempted
     *
     * @param options
     */
    constructor(options) {
        super(options);
        this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5 * 1000;
        const websocket = this.websocket;
        this.connectionTimeout = setTimeout(() => {
            console.log(`WebSocketChannelWithRetries: ctor(): Connection not opened in ${this.connectionTimeoutMs}ms, closing...`);
            websocket.close();
        }, this.connectionTimeoutMs);
        websocket.addEventListener("open", () => {
            clearTimeout(this.connectionTimeout);
            this._processRequestQueue();
        });
    }
    reconnect() {
        this.reconnectAttempts = 1;
        super.reconnect();
        if (this.connectionTimeout != null)
            clearTimeout(this.connectionTimeout);
        const websocket = this.websocket;
        this.connectionTimeout = setTimeout(() => {
            console.log(`WebSocketChannelWithRetries: reconnect(): Connection not opened in ${this.connectionTimeoutMs}ms, closing...`);
            websocket.close();
        }, this.connectionTimeoutMs);
        websocket.addEventListener("open", () => {
            clearTimeout(this.connectionTimeout);
        });
    }
}
exports.WebSocketChannelWithRetries = WebSocketChannelWithRetries;
