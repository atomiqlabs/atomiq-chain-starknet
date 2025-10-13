import { WebSocketChannel } from "starknet";
/**
 * An impl of WebSocketChannel which override the default exponential backoff and makes it linear
 */
export declare class WebSocketChannelWithRetries extends WebSocketChannel {
    reconnect(): void;
}
