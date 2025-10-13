import {WebSocketChannel} from "starknet";

/**
 * An impl of WebSocketChannel which override the default exponential backoff and makes it linear
 */
export class WebSocketChannelWithRetries extends WebSocketChannel {

    reconnect() {
        (this as any).reconnectAttempts = 1;
        super.reconnect();
    }

}