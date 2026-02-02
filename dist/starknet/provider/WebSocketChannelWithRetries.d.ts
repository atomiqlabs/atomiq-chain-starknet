import { WebSocketChannel, WebSocketOptions } from "starknet";
/**
 * An impl of WebSocketChannel which override the default exponential backoff and makes it linear
 * Also adds connection timeouts and retries if the initial connection fails. Retries indefinitely!
 *
 * @category Providers
 */
export declare class WebSocketChannelWithRetries extends WebSocketChannel {
    private connectionTimeout;
    private connectionTimeoutMs;
    /**
     * Creates a new websocket channel, you can pass an additional `options.connectionTimeoutMs` param, which
     *  defines a connection timeout, after the timeout the connection is re-attempted
     *
     * @param options
     */
    constructor(options: WebSocketOptions & {
        connectionTimeoutMs?: number;
    });
    reconnect(): void;
}
