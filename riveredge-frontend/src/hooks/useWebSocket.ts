/**
 * WebSocket Hook
 * 
 * 提供WebSocket连接管理的React Hook
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient, WebSocketMessage, createWebSocketClient } from '../services/websocket';

/**
 * WebSocket Hook返回值
 */
export interface UseWebSocketReturn {
  /** WebSocket客户端 */
  client: WebSocketClient | null;
  /** 是否已连接 */
  isConnected: boolean;
  /** 连接状态 */
  readyState: number;
  /** 连接WebSocket */
  connect: () => Promise<void>;
  /** 断开WebSocket连接 */
  disconnect: () => void;
  /** 订阅频道 */
  subscribe: (channel: string) => void;
  /** 取消订阅频道 */
  unsubscribe: (channel: string) => void;
  /** 发送消息 */
  send: (message: any) => void;
  /** 监听消息 */
  onMessage: (channel: string | null, handler: (message: WebSocketMessage) => void) => () => void;
}

/**
 * WebSocket Hook
 * 
 * @param channels 订阅的频道列表
 * @param autoConnect 是否自动连接（默认：true）
 * @returns WebSocket Hook返回值
 */
export function useWebSocket(
  channels: string[] = [],
  autoConnect: boolean = true
): UseWebSocketReturn {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [readyState, setReadyState] = useState(WebSocket.CLOSED);
  const clientRef = useRef<WebSocketClient | null>(null);

  /**
   * 连接WebSocket
   */
  const connect = useCallback(async () => {
    if (clientRef.current && clientRef.current.isConnected) {
      return;
    }

    const wsClient = createWebSocketClient(channels);
    clientRef.current = wsClient;
    setClient(wsClient);

    // 监听连接事件
    wsClient.onConnect(() => {
      setIsConnected(true);
      setReadyState(WebSocket.OPEN);
    });

    // 监听断开连接事件
    wsClient.onDisconnect(() => {
      setIsConnected(false);
      setReadyState(WebSocket.CLOSED);
    });

    // 监听错误事件
    wsClient.onError((error) => {
      console.error('WebSocket错误:', error);
      setIsConnected(false);
      setReadyState(WebSocket.CLOSED);
    });

    try {
      await wsClient.connect();
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      setIsConnected(false);
      setReadyState(WebSocket.CLOSED);
    }
  }, [channels]);

  /**
   * 断开WebSocket连接
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setClient(null);
      setIsConnected(false);
      setReadyState(WebSocket.CLOSED);
    }
  }, []);

  /**
   * 订阅频道
   */
  const subscribe = useCallback((channel: string) => {
    if (clientRef.current) {
      clientRef.current.subscribe(channel);
    }
  }, []);

  /**
   * 取消订阅频道
   */
  const unsubscribe = useCallback((channel: string) => {
    if (clientRef.current) {
      clientRef.current.unsubscribe(channel);
    }
  }, []);

  /**
   * 发送消息
   */
  const send = useCallback((message: any) => {
    if (clientRef.current) {
      clientRef.current.send(message);
    }
  }, []);

  /**
   * 监听消息
   */
  const onMessage = useCallback((
    channel: string | null,
    handler: (message: WebSocketMessage) => void
  ) => {
    if (clientRef.current) {
      return clientRef.current.onMessage(channel, handler);
    }
    return () => {};
  }, []);

  /**
   * 自动连接
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    client,
    isConnected,
    readyState,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
    onMessage,
  };
}
