"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketChannelWithRetries = void 0;
const starknet_1 = require("starknet");
/**
 * An impl of WebSocketChannel which override the default exponential backoff and makes it linear
 */
class WebSocketChannelWithRetries extends starknet_1.WebSocketChannel {
    reconnect() {
        this.reconnectAttempts = 1;
        super.reconnect();
    }
}
exports.WebSocketChannelWithRetries = WebSocketChannelWithRetries;
