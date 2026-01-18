/**
 * WebSocket服务
 * 
 * 提供WebSocket连接管理和实时数据推送功能
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { getToken } from '../utils/auth';

/**
 * WebSocket消息类型
 */
export type WebSocketMessageType = 
  | 'connected'
  | 'data'
  | 'subscribed'
  | 'unsubscribed'
  | 'pong'
  | 'error';

/**
 * WebSocket消息接口
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  channel?: string;
  data?: any;
  timestamp?: string;
  message?: string;
  connection_id?: string;
}

/**
 * WebSocket客户端类
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private channels: string[];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private messageHandlers: Map<string, Set<(message: WebSocketMessage) => void>> = new Map();
  private onConnectHandlers: Set<() => void> = new Set();
  private onDisconnectHandlers: Set<() => void> = new Set();
  private onErrorHandlers: Set<(error: Error) => void> = new Set();

  /**
   * 构造函数
   * 
   * @param url WebSocket服务器地址
   * @param channels 订阅的频道列表
   */
  constructor(url: string, channels: string[] = []) {
    this.url = url;
    this.channels = channels;
  }

  /**
   * 连接WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const token = getToken();
        if (!token) {
          reject(new Error('未找到访问令牌'));
          return;
        }

        // 构建WebSocket URL（包含token和channels参数）
        const wsUrl = new URL(this.url);
        wsUrl.searchParams.set('token', token);
        if (this.channels.length > 0) {
          wsUrl.searchParams.set('channels', this.channels.join(','));
        }

        this.ws = new WebSocket(wsUrl.toString());

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnectHandlers.forEach(handler => handler());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('解析WebSocket消息失败:', error);
          }
        };

        this.ws.onerror = (error) => {
          this.onErrorHandlers.forEach(handler => handler(new Error('WebSocket连接错误')));
          reject(error);
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.onDisconnectHandlers.forEach(handler => handler());
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 订阅频道
   * 
   * @param channel 频道名称
   */
  subscribe(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未连接，无法订阅频道');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: channel,
    }));

    if (!this.channels.includes(channel)) {
      this.channels.push(channel);
    }
  }

  /**
   * 取消订阅频道
   * 
   * @param channel 频道名称
   */
  unsubscribe(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未连接，无法取消订阅频道');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'unsubscribe',
      channel: channel,
    }));

    this.channels = this.channels.filter(ch => ch !== channel);
  }

  /**
   * 发送消息
   * 
   * @param message 消息内容
   */
  send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未连接，无法发送消息');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 监听消息
   * 
   * @param channel 频道名称（可选，如果不提供则监听所有消息）
   * @param handler 消息处理函数
   * @returns 取消监听的函数
   */
  onMessage(channel: string | null, handler: (message: WebSocketMessage) => void): () => void {
    const key = channel || '*';
    if (!this.messageHandlers.has(key)) {
      this.messageHandlers.set(key, new Set());
    }
    this.messageHandlers.get(key)!.add(handler);

    return () => {
      const handlers = this.messageHandlers.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(key);
        }
      }
    };
  }

  /**
   * 监听连接事件
   * 
   * @param handler 连接处理函数
   * @returns 取消监听的函数
   */
  onConnect(handler: () => void): () => void {
    this.onConnectHandlers.add(handler);
    return () => {
      this.onConnectHandlers.delete(handler);
    };
  }

  /**
   * 监听断开连接事件
   * 
   * @param handler 断开连接处理函数
   * @returns 取消监听的函数
   */
  onDisconnect(handler: () => void): () => void {
    this.onDisconnectHandlers.add(handler);
    return () => {
      this.onDisconnectHandlers.delete(handler);
    };
  }

  /**
   * 监听错误事件
   * 
   * @param handler 错误处理函数
   * @returns 取消监听的函数
   */
  onError(handler: (error: Error) => void): () => void {
    this.onErrorHandlers.add(handler);
    return () => {
      this.onErrorHandlers.delete(handler);
    };
  }

  /**
   * 处理消息
   * 
   * @param message WebSocket消息
   */
  private handleMessage(message: WebSocketMessage): void {
    // 处理特定频道的消息
    if (message.channel) {
      const handlers = this.messageHandlers.get(message.channel);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
    }

    // 处理所有消息
    const allHandlers = this.messageHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket重连次数已达上限');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    setTimeout(() => {
      console.log(`尝试重连WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(error => {
        console.error('WebSocket重连失败:', error);
      });
    }, delay);
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * 创建WebSocket客户端
 * 
 * @param channels 订阅的频道列表
 * @returns WebSocket客户端实例
 */
export function createWebSocketClient(channels: string[] = []): WebSocketClient {
  const wsUrl = process.env.VITE_WS_URL || 
    (process.env.VITE_API_TARGET 
      ? process.env.VITE_API_TARGET.replace('http://', 'ws://').replace('https://', 'wss://')
      : 'ws://127.0.0.1:8200') + '/api/v1/core/ws/connect';
  
  return new WebSocketClient(wsUrl, channels);
}
